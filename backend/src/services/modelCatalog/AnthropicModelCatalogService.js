import Anthropic from '@anthropic-ai/sdk';
import { err, ok } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';
/**
 * @implements {ModelCatalogService}
 */
export class AnthropicModelCatalogService {
    async listModels(apiKey) {
        try {
            const client = new Anthropic({ apiKey });
            const models = [];
            for await (const model of client.models.list()) {
                models.push({ id: model.id, displayName: model.display_name });
            }
            return ok(models);
        }
        catch (cause) {
            if (cause instanceof Anthropic.AuthenticationError) {
                return err(new ConfigurationError('The Anthropic API key was rejected — check it and try again', { cause: cause.message }));
            }
            return err(new ConfigurationError('Could not list available models', { cause: String(cause) }));
        }
    }
}
