import { Router } from 'express';
import type { ModelCatalogService } from '../../services/modelCatalog/ModelCatalogService.js';
import type { LlmProvider } from '../../domain/models/LlmProvider.js';

interface ListModelsRequestBody {
  readonly apiKey?: unknown;
  readonly provider?: unknown;
}

const DEFAULT_PROVIDER: LlmProvider = 'anthropic';

function isLlmProvider(value: unknown, catalog: Readonly<Record<LlmProvider, ModelCatalogService>>): value is LlmProvider {
  return typeof value === 'string' && value in catalog;
}

export function buildModelRoutes(modelCatalogsByProvider: Readonly<Record<LlmProvider, ModelCatalogService>>): Router {
  const router = Router();

  router.post('/models', async (request, response) => {
    const body = request.body as ListModelsRequestBody;
    if (typeof body.apiKey !== 'string' || body.apiKey.trim().length === 0) {
      response.status(400).json({ error: '"apiKey" is required and must be a non-empty string' });
      return;
    }

    const provider = body.provider ?? DEFAULT_PROVIDER;
    if (!isLlmProvider(provider, modelCatalogsByProvider)) {
      response.status(400).json({ error: `"provider" must be one of: ${Object.keys(modelCatalogsByProvider).join(', ')}` });
      return;
    }

    // Every ModelCatalogService implementation already catches its own errors into a Result,
    // but this call still needs its own safety net: an async Express 4 handler that rejects
    // without being caught becomes an unhandled promise rejection, which recent Node.js
    // versions treat as fatal by default — crashing the whole server mid-response, which the
    // browser sees as a truncated body ("Unexpected end of JSON input"), not a clean error.
    try {
      const result = await modelCatalogsByProvider[provider].listModels(body.apiKey);
      if (!result.ok) {
        response.status(401).json({ error: result.error.message });
        return;
      }
      response.json({ models: result.value });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  return router;
}
