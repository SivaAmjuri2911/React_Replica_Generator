import OpenAI from 'openai';
import { err, ok } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';

const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
/** Real Mistral Studio keys are 32 alphanumeric characters with no prefix. */
const MISTRAL_API_KEY_PATTERN = /^[A-Za-z0-9]{32}$/;

function validateMistralApiKey(apiKey) {
    if (MISTRAL_API_KEY_PATTERN.test(apiKey)) {
        return undefined;
    }
    return new ConfigurationError(`This does not look like a valid Mistral API key — Mistral keys are exactly 32 letters and numbers with no prefix (yours is ${apiKey.length} characters). Create one at https://console.mistral.ai/ → API Keys.`);
}

/** Speech, embedding, and moderation models don't support chat-based spec drafting. */
const NON_CHAT_MODEL_PATTERN = /(?:voxtral|embed|moderation|transcribe|realtime|ocr)/i;

function isChatCapableMistralModel(modelId) {
    return !NON_CHAT_MODEL_PATTERN.test(modelId);
}

/**
 * Mistral exposes an OpenAI-compatible REST surface, so this reuses the
 * `openai` package pointed at api.mistral.ai rather than a bespoke client.
 */
/**
 * @implements {ModelCatalogService}
 */
export class MistralModelCatalogService {
    async listModels(apiKey) {
        const formatError = validateMistralApiKey(apiKey);
        if (formatError) {
            return err(formatError);
        }
        try {
            const client = new OpenAI({ apiKey, baseURL: MISTRAL_BASE_URL });
            const models = [];
            for await (const model of client.models.list()) {
                if (!isChatCapableMistralModel(model.id)) {
                    continue;
                }
                models.push({ id: model.id, displayName: model.id });
            }
            return ok(models);
        }
        catch (cause) {
            if (cause instanceof OpenAI.AuthenticationError) {
                return err(new ConfigurationError('The Mistral API key was rejected — check it and try again', { cause: cause.message }));
            }
            return err(new ConfigurationError('Could not list available models', { cause: String(cause) }));
        }
    }
}
