import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { err, ok, type Result } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';
import type { ScenarioSpecDraft } from '../../domain/models/ScenarioSpecDraft.js';
import type { Logger } from '../../logging/Logger.js';
import type { ScenarioSpecGenerationRequest, ScenarioSpecGenerationService } from './ScenarioSpecGenerationService.js';
import {
  buildScenarioSpecDraftUserPrompt,
  buildScenarioSpecRevisionUserPrompt,
  scenarioSpecDraftSchema,
  SCENARIO_SPEC_DRAFT_SCHEMA_NAME,
  SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT,
} from './scenarioSpecDraftContract.js';
import { streamChatCompletion } from './streamChatCompletion.js';
import { extractJsonPayload } from './extractJsonPayload.js';

const RAW_CONTENT_PREVIEW_CHARS = 500;

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
/** Fallback only — the UI always sends an explicit modelId chosen from a live /api/models call. */
const DEFAULT_MODEL_ID = 'anthropic/claude-3.5-sonnet';
const MAX_OUTPUT_TOKENS = 64000;

/**
 * OpenRouter routes to many different underlying providers/models — not
 * every one of them honors `response_format: json_schema` the same way
 * Claude/OpenAI's own APIs do. When a chosen model doesn't, the failure
 * surfaces honestly here (JSON parse or schema-validation error) rather
 * than pretending structured output is guaranteed platform-wide.
 */
export class OpenRouterScenarioSpecGenerationService implements ScenarioSpecGenerationService {
  private readonly injectedDefaultClient: OpenAI | undefined;
  private readonly logger: Logger;

  constructor(logger: Logger, injectedDefaultClient?: OpenAI) {
    this.logger = logger;
    this.injectedDefaultClient = injectedDefaultClient;
  }

  async generateDraft(
    request: ScenarioSpecGenerationRequest
  ): Promise<Result<ScenarioSpecDraft, ConfigurationError>> {
    return this.requestDraft(request, buildScenarioSpecDraftUserPrompt(request));
  }

  async reviseDraft(
    request: ScenarioSpecGenerationRequest,
    previousDraft: ScenarioSpecDraft,
    failureSummary: string
  ): Promise<Result<ScenarioSpecDraft, ConfigurationError>> {
    return this.requestDraft(request, buildScenarioSpecRevisionUserPrompt(request, previousDraft, failureSummary));
  }

  private async requestDraft(
    request: ScenarioSpecGenerationRequest,
    userPrompt: string
  ): Promise<Result<ScenarioSpecDraft, ConfigurationError>> {
    const modelId = request.modelId ?? DEFAULT_MODEL_ID;
    this.logger.info('Requesting scenario spec draft from OpenRouter', {
      model: modelId,
      fileCount: request.baseSolutionCodeFiles.length,
    });

    let client: OpenAI;
    try {
      client = request.apiKey
        ? new OpenAI({ apiKey: request.apiKey, baseURL: OPENROUTER_BASE_URL })
        : (this.injectedDefaultClient ?? new OpenAI({ baseURL: OPENROUTER_BASE_URL }));
    } catch (cause) {
      return err(new ConfigurationError('Could not construct an OpenRouter client from the supplied API key', { cause: String(cause) }));
    }

    try {
      const { content, refusal, finishReason, maxCompletionTokensUsed, wasReducedForAffordability } = await streamChatCompletion(client, {
        model: modelId,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: 'system', content: SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: zodResponseFormat(scenarioSpecDraftSchema, SCENARIO_SPEC_DRAFT_SCHEMA_NAME),
      }, this.logger);

      if (refusal) {
        return err(new ConfigurationError('The model declined to generate a scenario spec draft', { refusal }));
      }
      if (finishReason === 'length') {
        return err(
          new ConfigurationError(
            wasReducedForAffordability
              ? `Your OpenRouter account balance could only afford ${maxCompletionTokensUsed} output tokens for this request — not enough to finish drafting a spec for a project this size (which normally needs up to ${MAX_OUTPUT_TOKENS}). Add credit at https://openrouter.ai/settings/credits, or switch to a cheaper/smaller base project, and try again.`
              : `The draft was truncated at the ${maxCompletionTokensUsed ?? MAX_OUTPUT_TOKENS}-token output cap — the base project is too large for one request`
          )
        );
      }
      if (!content) {
        return err(new ConfigurationError('OpenRouter returned no text content for the scenario spec draft'));
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch {
        // Some OpenRouter-routed models don't honor response_format: json_schema strictly —
        // they wrap the object in a markdown code fence or add stray prose around it despite
        // being asked for bare JSON. Try recovering the actual object before giving up.
        try {
          parsedJson = JSON.parse(extractJsonPayload(content));
        } catch (cause) {
          return err(
            new ConfigurationError(
              "OpenRouter returned text that was not valid JSON — the chosen model may not support structured outputs",
              { cause: String(cause), rawContentPreview: content.slice(0, RAW_CONTENT_PREVIEW_CHARS) }
            )
          );
        }
      }

      const validation = scenarioSpecDraftSchema.safeParse(parsedJson);
      if (!validation.success) {
        return err(
          new ConfigurationError("The draft did not match the required schema", {
            issues: validation.error.issues,
          })
        );
      }

      this.logger.info('Received scenario spec draft', {
        scenarioName: validation.data.scenarioName,
        transformableFileCount: validation.data.transformableRelativePaths.length,
        manuallyAuthoredFileCount: validation.data.manuallyAuthoredFiles.length,
      });

      return ok(validation.data);
    } catch (cause) {
      if (cause instanceof OpenAI.AuthenticationError) {
        return err(new ConfigurationError('The OpenRouter API key was rejected — check it and try again', { cause: cause.message }));
      }
      return err(
        new ConfigurationError('Scenario spec draft generation failed', { cause: String(cause) })
      );
    }
  }
}
