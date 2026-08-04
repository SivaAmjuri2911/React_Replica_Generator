import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { err, ok, type Result } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';
import type { ScenarioSpecDraft } from '../../domain/models/ScenarioSpecDraft.js';
import type { Logger } from '../../logging/Logger.js';
import type { ScenarioSpecGenerationRequest, ScenarioSpecGenerationService } from './ScenarioSpecGenerationService.js';
import {
  buildScenarioSpecDraftUserPrompt,
  buildScenarioSpecRevisionUserPrompt,
  scenarioSpecDraftSchema,
  SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT,
} from './scenarioSpecDraftContract.js';

const DEFAULT_MODEL_ID = 'claude-opus-5';
const MAX_OUTPUT_TOKENS = 64000;

export class ClaudeScenarioSpecGenerationService implements ScenarioSpecGenerationService {
  /**
   * Used only when a request carries no apiKey — e.g. the CLI, which relies
   * on env-var/`ant auth login` resolution. Constructed lazily (not as a
   * default parameter) for the same reason as OpenAiScenarioSpecGenerationService:
   * don't force env-credential resolution at CompositionRoot wiring time.
   */
  private readonly injectedDefaultClient: Anthropic | undefined;
  private readonly logger: Logger;

  constructor(logger: Logger, injectedDefaultClient?: Anthropic) {
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
    this.logger.info('Requesting scenario spec draft from Claude', {
      model: modelId,
      fileCount: request.baseSolutionCodeFiles.length,
    });

    let client: Anthropic;
    try {
      client = request.apiKey ? new Anthropic({ apiKey: request.apiKey }) : (this.injectedDefaultClient ?? new Anthropic());
    } catch (cause) {
      return err(new ConfigurationError('Could not construct an Anthropic client from the supplied API key', { cause: String(cause) }));
    }

    try {
      const stream = client.messages.stream({
        model: modelId,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        output_config: { format: zodOutputFormat(scenarioSpecDraftSchema) },
      });

      const finalMessage = await stream.finalMessage();

      if (finalMessage.stop_reason === 'refusal') {
        return err(
          new ConfigurationError('Claude declined to generate a scenario spec draft', {
            stopDetails: finalMessage.stop_details,
          })
        );
      }
      if (finalMessage.stop_reason === 'max_tokens') {
        return err(
          new ConfigurationError(
            `Claude's draft was truncated at the ${MAX_OUTPUT_TOKENS}-token output cap — the base project is too large for one request`
          )
        );
      }

      const textBlock = finalMessage.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        return err(new ConfigurationError('Claude returned no text content for the scenario spec draft'));
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(textBlock.text);
      } catch (cause) {
        return err(
          new ConfigurationError('Claude returned text that was not valid JSON', { cause: String(cause) })
        );
      }

      const validation = scenarioSpecDraftSchema.safeParse(parsedJson);
      if (!validation.success) {
        return err(
          new ConfigurationError("Claude's draft did not match the required schema", {
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
      if (cause instanceof Anthropic.AuthenticationError) {
        return err(new ConfigurationError('The Anthropic API key was rejected — check it and try again', { cause: cause.message }));
      }
      return err(
        new ConfigurationError('Scenario spec draft generation failed', { cause: String(cause) })
      );
    }
  }
}
