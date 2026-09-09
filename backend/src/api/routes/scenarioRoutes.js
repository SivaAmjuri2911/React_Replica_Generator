import { Router } from 'express';
export function buildScenarioRoutes(repository) {
    const router = Router();
    router.get('/scenarios', async (_request, response) => {
        try {
            const scenarios = await repository.listAvailable();
            response.json({ scenarios });
        }
        catch (error) {
            response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
        }
    });
    return router;
}
