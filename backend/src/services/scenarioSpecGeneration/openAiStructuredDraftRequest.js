import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { err, ok } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';
import { extractJsonPayload } from './extractJsonPayload.js';
import { streamChatCompletion } from './streamChatCompletion.js';

const RAW_CONTENT_PREVIEW_CHARS = 500;
const MAX_OUTPUT_TOKENS = 64000;

/**
 * @param {{
 *   client: OpenAI,
 *   logger: import('../../logging/Logger.js').Logger,
 *   modelId: string,
 *   systemPrompt: string,
 *   userPrompt: string,
 *   schema: import('zod').ZodTypeAny,
 *   schemaName: string,
 *   providerLabel: string,
 *   phaseLabel: string,
 *   allowJsonRecovery?: boolean,
 * }} params
 */
export async function requestOpenAiStructuredDraft(params) {
    const {
        client,
        logger,
        modelId,
        systemPrompt,
        userPrompt,
        schema,
        schemaName,
        providerLabel,
        phaseLabel,
        allowJsonRecovery = false,
    } = params;

    try {
        const { content, refusal, finishReason, maxCompletionTokensUsed, wasReducedForAffordability } = await streamChatCompletion(client, {
            model: modelId,
            max_completion_tokens: MAX_OUTPUT_TOKENS,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            response_format: zodResponseFormat(schema, schemaName),
        }, logger);

        if (refusal) {
            return err(new ConfigurationError(`${providerLabel} declined during ${phaseLabel}`, { refusal }));
        }
        if (finishReason === 'length') {
            return err(new ConfigurationError(wasReducedForAffordability
                ? `Your ${providerLabel} account balance could only afford ${maxCompletionTokensUsed} output tokens for the ${phaseLabel} phase — not enough for a project this size. Add credit and try again.`
                : `${providerLabel}'s ${phaseLabel} response was truncated at the ${maxCompletionTokensUsed ?? MAX_OUTPUT_TOKENS}-token output cap — the base project is still too large for this phase`));
        }
        if (!content) {
            return err(new ConfigurationError(`${providerLabel} returned no text content for ${phaseLabel}`));
        }

        let parsedJson;
        try {
            parsedJson = JSON.parse(content);
        }
        catch {
            if (!allowJsonRecovery) {
                return err(new ConfigurationError(`${providerLabel} returned text that was not valid JSON during ${phaseLabel}`));
            }
            try {
                parsedJson = JSON.parse(extractJsonPayload(content));
            }
            catch (cause) {
                return err(new ConfigurationError(`${providerLabel} returned text that was not valid JSON during ${phaseLabel}`, {
                    cause: String(cause),
                    rawContentPreview: content.slice(0, RAW_CONTENT_PREVIEW_CHARS),
                }));
            }
        }

        const validation = schema.safeParse(parsedJson);
        if (!validation.success) {
            return err(new ConfigurationError(`${providerLabel}'s ${phaseLabel} response did not match the required schema`, {
                issues: validation.error.issues,
            }));
        }
        return ok(validation.data);
    }
    catch (cause) {
        if (cause instanceof OpenAI.AuthenticationError) {
            return err(new ConfigurationError(`The ${providerLabel} API key was rejected — check it and try again`, { cause: cause.message }));
        }
        return err(new ConfigurationError(`${providerLabel} ${phaseLabel} request failed`, { cause: String(cause) }));
    }
}
