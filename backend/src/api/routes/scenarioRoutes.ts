import { Router } from 'express';
import type { ScenarioSpecRepository } from '../../config/ScenarioSpecRepository.js';

export function buildScenarioRoutes(repository: ScenarioSpecRepository): Router {
  const router = Router();

  router.get('/scenarios', async (_request, response) => {
    try {
      const scenarios = await repository.listAvailable();
      response.json({ scenarios });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  return router;
}
