import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { err, ok } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';
import { buildScenarioSpecDraftUserPrompt, buildScenarioSpecRevisionUserPrompt, scenarioSpecDraftSchema, SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT, } from './scenarioSpecDraftContract.js';
import { generateScenarioSpecDraftWithPhasedFallback } from './generateScenarioSpecDraftWithPhasedFallback.js';
import { requestAnthropicStructuredDraft } from './anthropicStructuredDraftRequest.js';
const DEFAULT_MODEL_ID = 'claude-opus-5';
const MAX_OUTPUT_TOKENS = 64000;
/**
 * @implements {ScenarioSpecGenerationService}
 */
export class ClaudeScenarioSpecGenerationService {
    injectedDefaultClient;
    logger;
    constructor(logger, injectedDefaultClient) {
        this.logger = logger;
        this.injectedDefaultClient = injectedDefaultClient;
    }
    async generateDraft(request) {
        return generateScenarioSpecDraftWithPhasedFallback(request, {
            logger: this.logger,
            providerLabel: 'Claude',
            requestFullDraft: (draftRequest) => this.requestDraft(draftRequest, buildScenarioSpecDraftUserPrompt(draftRequest)),
            invokeStructured: (params) => this.invokeStructured(request, params),
        });
    }
    async reviseDraft(request, previousDraft, failureSummary) {
        return this.requestDraft(request, buildScenarioSpecRevisionUserPrompt(request, previousDraft, failureSummary));
    }
    createClient(request) {
        try {
            return request.apiKey ? new Anthropic({ apiKey: request.apiKey }) : (this.injectedDefaultClient ?? new Anthropic());
        }
        catch (cause) {
            throw new ConfigurationError('Could not construct an Anthropic client from the supplied API key', { cause: String(cause) });
        }
    }
    /**
     * @param {import('./ScenarioSpecGenerationService.js').ScenarioSpecGenerationRequest} request
     * @param {import('./phasedScenarioSpecDraft.js').StructuredDraftRequest} params
     */
    async invokeStructured(request, params) {
        let client;
        try {
            client = this.createClient(request);
        }
        catch (error) {
            return err(error instanceof ConfigurationError ? error : new ConfigurationError(String(error)));
        }
        return requestAnthropicStructuredDraft({
            client,
            modelId: request.modelId ?? DEFAULT_MODEL_ID,
            systemPrompt: params.systemPrompt,
            userPrompt: params.userPrompt,
            schema: params.schema,
            phaseLabel: params.phaseLabel,
        });
    }
    async requestDraft(request, userPrompt) {
        const modelId = request.modelId ?? DEFAULT_MODEL_ID;
        this.logger.info('Requesting scenario spec draft from Claude', {
            model: modelId,
            fileCount: request.baseSolutionCodeFiles.length,
        });
        let client;
        try {
            client = this.createClient(request);
        }
        catch (error) {
            return err(error instanceof ConfigurationError ? error : new ConfigurationError(String(error)));
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
                return err(new ConfigurationError('Claude declined to generate a scenario spec draft', {
                    stopDetails: finalMessage.stop_details,
                }));
            }
            if (finalMessage.stop_reason === 'max_tokens') {
                return err(new ConfigurationError(`Claude's draft was truncated at the ${MAX_OUTPUT_TOKENS}-token output cap — the base project is too large for one request`));
            }
            const textBlock = finalMessage.content.find((block) => block.type === 'text');
            if (!textBlock || textBlock.type !== 'text') {
                return err(new ConfigurationError('Claude returned no text content for the scenario spec draft'));
            }
            let parsedJson;
            try {
                parsedJson = JSON.parse(textBlock.text);
            }
            catch (cause) {
                return err(new ConfigurationError('Claude returned text that was not valid JSON', { cause: String(cause) }));
            }
            const validation = scenarioSpecDraftSchema.safeParse(parsedJson);
            if (!validation.success) {
                return err(new ConfigurationError("Claude's draft did not match the required schema", {
                    issues: validation.error.issues,
                }));
            }
            this.logger.info('Received scenario spec draft', {
                scenarioName: validation.data.scenarioName,
                transformableFileCount: validation.data.transformableRelativePaths.length,
                manuallyAuthoredFileCount: validation.data.manuallyAuthoredFiles.length,
            });
            return ok(validation.data);
        }
        catch (cause) {
            if (cause instanceof Anthropic.AuthenticationError) {
                return err(new ConfigurationError('The Anthropic API key was rejected — check it and try again', { cause: cause.message }));
            }
            return err(new ConfigurationError('Scenario spec draft generation failed', { cause: String(cause) }));
        }
    }
}
