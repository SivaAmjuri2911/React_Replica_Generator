import OpenAI from 'openai';
import { err, ok } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * OpenRouter's model objects carry a human-readable "name" the OpenAI SDK's Model type doesn't declare.
 * @typedef {object} OpenRouterModelFields
 * @property {string} id
 * @property {string} [name]
 */

/**
 * OpenRouter exposes an OpenAI-compatible REST surface (its own recommended
 * integration path is "point the OpenAI SDK at our baseURL"), so this reuses
 * the `openai` package rather than adding a third bespoke HTTP client.
 */
/**
 * @implements {ModelCatalogService}
 */
export class OpenRouterModelCatalogService {
    async listModels(apiKey) {
        try {
            const client = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
            const models = [];
            for await (const model of client.models.list()) {
                const fields = model;
                models.push({ id: fields.id, displayName: fields.name ?? fields.id });
            }
            return ok(models);
        }
        catch (cause) {
            if (cause instanceof OpenAI.AuthenticationError) {
                return err(new ConfigurationError('The OpenRouter API key was rejected — check it and try again', { cause: cause.message }));
            }
            return err(new ConfigurationError('Could not list available models', { cause: String(cause) }));
        }
    }
}
