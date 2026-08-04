import OpenAI from 'openai';
import type { ModelCatalogService } from './ModelCatalogService.js';
import { err, ok, type Result } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';
import type { ModelSummary } from '../../domain/models/ModelSummary.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** OpenRouter's model objects carry a human-readable "name" the OpenAI SDK's Model type doesn't declare. */
interface OpenRouterModelFields {
  readonly id: string;
  readonly name?: string;
}

/**
 * OpenRouter exposes an OpenAI-compatible REST surface (its own recommended
 * integration path is "point the OpenAI SDK at our baseURL"), so this reuses
 * the `openai` package rather than adding a third bespoke HTTP client.
 */
export class OpenRouterModelCatalogService implements ModelCatalogService {
  async listModels(apiKey: string): Promise<Result<readonly ModelSummary[], ConfigurationError>> {
    try {
      const client = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
      const models: ModelSummary[] = [];
      for await (const model of client.models.list()) {
        const fields = model as unknown as OpenRouterModelFields;
        models.push({ id: fields.id, displayName: fields.name ?? fields.id });
      }
      return ok(models);
    } catch (cause) {
      if (cause instanceof OpenAI.AuthenticationError) {
        return err(new ConfigurationError('The OpenRouter API key was rejected — check it and try again', { cause: cause.message }));
      }
      return err(new ConfigurationError('Could not list available models', { cause: String(cause) }));
    }
  }
}
