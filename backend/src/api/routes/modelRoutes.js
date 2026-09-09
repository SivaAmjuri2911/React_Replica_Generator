import { Router } from 'express';

/**
 * @typedef {object} ListModelsRequestBody
 * @property {unknown} [apiKey]
 * @property {unknown} [provider]
 */

const DEFAULT_PROVIDER = 'anthropic';
function isLlmProvider(value, catalog) {
    return typeof value === 'string' && value in catalog;
}
export function buildModelRoutes(modelCatalogsByProvider) {
    const router = Router();
    router.post('/models', async (request, response) => {
        const body = request.body;
        if (typeof body.apiKey !== 'string' || body.apiKey.trim().length === 0) {
            response.status(400).json({ error: '"apiKey" is required and must be a non-empty string' });
            return;
        }
        const provider = body.provider ?? DEFAULT_PROVIDER;
        if (!isLlmProvider(provider, modelCatalogsByProvider)) {
            response.status(400).json({ error: `"provider" must be one of: ${Object.keys(modelCatalogsByProvider).join(', ')}` });
            return;
        }
        const apiKey = body.apiKey.trim();
        // Every ModelCatalogService implementation already catches its own errors into a Result,
        // but this call still needs its own safety net: an async Express 4 handler that rejects
        // without being caught becomes an unhandled promise rejection, which recent Node.js
        // versions treat as fatal by default — crashing the whole server mid-response, which the
        // browser sees as a truncated body ("Unexpected end of JSON input"), not a clean error.
        try {
            const result = await modelCatalogsByProvider[provider].listModels(apiKey);
            if (!result.ok) {
                const status = result.error.message.includes('does not look like a valid Mistral API key') ? 400 : 401;
                response.status(status).json({ error: result.error.message });
                return;
            }
            response.json({ models: result.value });
        }
        catch (error) {
            response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
        }
    });
    return router;
}
