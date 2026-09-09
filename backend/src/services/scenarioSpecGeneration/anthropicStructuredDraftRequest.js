import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { err, ok } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';

const MAX_OUTPUT_TOKENS = 64000;

/**
 * @param {{
 *   client: Anthropic,
 *   modelId: string,
 *   systemPrompt: string,
 *   userPrompt: string,
 *   schema: import('zod').ZodTypeAny,
 *   phaseLabel: string,
 * }} params
 */
export async function requestAnthropicStructuredDraft(params) {
    const { client, modelId, systemPrompt, userPrompt, schema, phaseLabel } = params;

    try {
        const stream = client.messages.stream({
            model: modelId,
            max_tokens: MAX_OUTPUT_TOKENS,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            output_config: { format: zodOutputFormat(schema) },
        });
        const finalMessage = await stream.finalMessage();

        if (finalMessage.stop_reason === 'refusal') {
            return err(new ConfigurationError(`Claude declined during ${phaseLabel}`, {
                stopDetails: finalMessage.stop_details,
            }));
        }
        if (finalMessage.stop_reason === 'max_tokens') {
            return err(new ConfigurationError(`Claude's ${phaseLabel} response was truncated at the ${MAX_OUTPUT_TOKENS}-token output cap — the base project is still too large for this phase`));
        }

        const textBlock = finalMessage.content.find((block) => block.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
            return err(new ConfigurationError(`Claude returned no text content for ${phaseLabel}`));
        }

        let parsedJson;
        try {
            parsedJson = JSON.parse(textBlock.text);
        }
        catch (cause) {
            return err(new ConfigurationError(`Claude returned text that was not valid JSON during ${phaseLabel}`, { cause: String(cause) }));
        }

        const validation = schema.safeParse(parsedJson);
        if (!validation.success) {
            return err(new ConfigurationError(`Claude's ${phaseLabel} response did not match the required schema`, {
                issues: validation.error.issues,
            }));
        }
        return ok(validation.data);
    }
    catch (cause) {
        if (cause instanceof Anthropic.AuthenticationError) {
            return err(new ConfigurationError('The Anthropic API key was rejected — check it and try again', { cause: cause.message }));
        }
        return err(new ConfigurationError(`Claude ${phaseLabel} request failed`, { cause: String(cause) }));
    }
}
