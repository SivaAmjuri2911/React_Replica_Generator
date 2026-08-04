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

/** Fallback only — the UI always sends an explicit modelId chosen from a live /api/models call. */
const DEFAULT_MODEL_ID = 'gpt-4o';
const MAX_OUTPUT_TOKENS = 64000;

export class OpenAiScenarioSpecGenerationService implements ScenarioSpecGenerationService {
  /**
   * Used only when a request carries no apiKey — e.g. a caller relying on
   * OPENAI_API_KEY in the environment. Constructed lazily (not as a default
   * parameter) because `new OpenAI()` throws synchronously when no
   * credential is resolvable, unlike `new Anthropic()` — eagerly
   * constructing it here would break CompositionRoot's wiring even for
   * requests that never use this provider at all.
   */
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
    this.logger.info('Requesting scenario spec draft from OpenAI', {
      model: modelId,
      fileCount: request.baseSolutionCodeFiles.length,
    });

    let client: OpenAI;
    try {
      client = request.apiKey ? new OpenAI({ apiKey: request.apiKey }) : (this.injectedDefaultClient ?? new OpenAI());
    } catch (cause) {
      return err(new ConfigurationError('Could not construct an OpenAI client from the supplied API key', { cause: String(cause) }));
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
        return err(new ConfigurationError('OpenAI declined to generate a scenario spec draft', { refusal }));
      }
      if (finishReason === 'length') {
        return err(
          new ConfigurationError(
            wasReducedForAffordability
              ? `Your OpenAI account balance could only afford ${maxCompletionTokensUsed} output tokens for this request — not enough to finish drafting a spec for a project this size (which normally needs up to ${MAX_OUTPUT_TOKENS}). Add credit and try again.`
              : `OpenAI's draft was truncated at the ${maxCompletionTokensUsed ?? MAX_OUTPUT_TOKENS}-token output cap — the base project is too large for one request`
          )
        );
      }
      if (!content) {
        return err(new ConfigurationError('OpenAI returned no text content for the scenario spec draft'));
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch (cause) {
        return err(
          new ConfigurationError('OpenAI returned text that was not valid JSON', { cause: String(cause) })
        );
      }

      const validation = scenarioSpecDraftSchema.safeParse(parsedJson);
      if (!validation.success) {
        return err(
          new ConfigurationError("OpenAI's draft did not match the required schema", {
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
        return err(new ConfigurationError('The OpenAI API key was rejected — check it and try again', { cause: cause.message }));
      }
      return err(
        new ConfigurationError('Scenario spec draft generation failed', { cause: String(cause) })
      );
    }
  }
}
