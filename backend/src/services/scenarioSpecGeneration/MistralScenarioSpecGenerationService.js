import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { err, ok } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';
import { buildScenarioSpecDraftUserPrompt, buildScenarioSpecRevisionUserPrompt, scenarioSpecDraftSchema, SCENARIO_SPEC_DRAFT_SCHEMA_NAME, SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT, } from './scenarioSpecDraftContract.js';
import { streamChatCompletion } from './streamChatCompletion.js';
import { extractJsonPayload } from './extractJsonPayload.js';
import { generateScenarioSpecDraftWithPhasedFallback } from './generateScenarioSpecDraftWithPhasedFallback.js';
import { requestOpenAiStructuredDraft } from './openAiStructuredDraftRequest.js';

const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
const RAW_CONTENT_PREVIEW_CHARS = 500;
/** Fallback only — the UI always sends an explicit modelId chosen from a live /api/models call. */
const DEFAULT_MODEL_ID = 'mistral-large-latest';
const MAX_OUTPUT_TOKENS = 64000;

/**
 * @implements {ScenarioSpecGenerationService}
 */
export class MistralScenarioSpecGenerationService {
    injectedDefaultClient;
    logger;
    constructor(logger, injectedDefaultClient) {
        this.logger = logger;
        this.injectedDefaultClient = injectedDefaultClient;
    }
    async generateDraft(request) {
        return generateScenarioSpecDraftWithPhasedFallback(request, {
            logger: this.logger,
            providerLabel: 'Mistral',
            requestFullDraft: (draftRequest) => this.requestDraft(draftRequest, buildScenarioSpecDraftUserPrompt(draftRequest)),
            invokeStructured: (params) => this.invokeStructured(request, params),
        });
    }
    async reviseDraft(request, previousDraft, failureSummary) {
        return this.requestDraft(request, buildScenarioSpecRevisionUserPrompt(request, previousDraft, failureSummary));
    }
    createClient(request) {
        try {
            return request.apiKey
                ? new OpenAI({ apiKey: request.apiKey, baseURL: MISTRAL_BASE_URL })
                : (this.injectedDefaultClient ?? new OpenAI({
                    apiKey: process.env.MISTRAL_API_KEY,
                    baseURL: MISTRAL_BASE_URL,
                }));
        }
        catch (cause) {
            throw new ConfigurationError('Could not construct a Mistral client from the supplied API key', { cause: String(cause) });
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
        return requestOpenAiStructuredDraft({
            client,
            logger: this.logger,
            modelId: request.modelId ?? DEFAULT_MODEL_ID,
            systemPrompt: params.systemPrompt,
            userPrompt: params.userPrompt,
            schema: params.schema,
            schemaName: params.schemaName,
            providerLabel: 'Mistral',
            phaseLabel: params.phaseLabel,
            allowJsonRecovery: true,
        });
    }
    async requestDraft(request, userPrompt) {
        const modelId = request.modelId ?? DEFAULT_MODEL_ID;
        this.logger.info('Requesting scenario spec draft from Mistral', {
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
                return err(new ConfigurationError('Mistral declined to generate a scenario spec draft', { refusal }));
            }
            if (finishReason === 'length') {
                return err(new ConfigurationError(wasReducedForAffordability
                    ? `Your Mistral account balance could only afford ${maxCompletionTokensUsed} output tokens for this request — not enough to finish drafting a spec for a project this size (which normally needs up to ${MAX_OUTPUT_TOKENS}). Add credit and try again.`
                    : `Mistral's draft was truncated at the ${maxCompletionTokensUsed ?? MAX_OUTPUT_TOKENS}-token output cap — the base project is too large for one request`));
            }
            if (!content) {
                return err(new ConfigurationError('Mistral returned no text content for the scenario spec draft'));
            }
            let parsedJson;
            try {
                parsedJson = JSON.parse(content);
            }
            catch {
                try {
                    parsedJson = JSON.parse(extractJsonPayload(content));
                }
                catch (cause) {
                    return err(new ConfigurationError("Mistral returned text that was not valid JSON — the chosen model may not support structured outputs", { cause: String(cause), rawContentPreview: content.slice(0, RAW_CONTENT_PREVIEW_CHARS) }));
                }
            }
            const validation = scenarioSpecDraftSchema.safeParse(parsedJson);
            if (!validation.success) {
                return err(new ConfigurationError("Mistral's draft did not match the required schema", {
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
            if (cause instanceof OpenAI.AuthenticationError) {
                return err(new ConfigurationError('The Mistral API key was rejected — check it and try again', { cause: cause.message }));
            }
            return err(new ConfigurationError('Scenario spec draft generation failed', { cause: String(cause) }));
        }
    }
}
