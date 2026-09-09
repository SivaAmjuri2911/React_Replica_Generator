import OpenAI from 'openai';
import { err, ok } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';
/**
 * @implements {ModelCatalogService}
 */
export class OpenAiModelCatalogService {
    async listModels(apiKey) {
        try {
            const client = new OpenAI({ apiKey });
            const models = [];
            for await (const model of client.models.list()) {
                // OpenAI's Model has no separate human-readable name — its id doubles as both.
                models.push({ id: model.id, displayName: model.id });
            }
            return ok(models);
        }
        catch (cause) {
            if (cause instanceof OpenAI.AuthenticationError) {
                return err(new ConfigurationError('The OpenAI API key was rejected — check it and try again', { cause: cause.message }));
            }
            return err(new ConfigurationError('Could not list available models', { cause: String(cause) }));
        }
    }
}
