import { loadEnvFile } from '../config/loadEnv.js';
loadEnvFile();
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { CompositionRoot } from '../config/CompositionRoot.js';
import { FileSystemScenarioSpecRepository } from '../config/FileSystemScenarioSpecRepository.js';
import { InMemoryGenerationJobService } from './services/InMemoryGenerationJobService.js';
import { InMemoryAnalysisJobService } from './services/InMemoryAnalysisJobService.js';
import { AnthropicModelCatalogService } from '../services/modelCatalog/AnthropicModelCatalogService.js';
import { OpenAiModelCatalogService } from '../services/modelCatalog/OpenAiModelCatalogService.js';
import { OpenRouterModelCatalogService } from '../services/modelCatalog/OpenRouterModelCatalogService.js';
import { MistralModelCatalogService } from '../services/modelCatalog/MistralModelCatalogService.js';
import { buildScenarioRoutes } from './routes/scenarioRoutes.js';
import { buildGenerationRoutes } from './routes/generationRoutes.js';
import { buildAnalysisRoutes } from './routes/analysisRoutes.js';
import { buildModelRoutes } from './routes/modelRoutes.js';
import { buildAnalysisSessionRoutes } from './routes/analysisSessionRoutes.js';
// server.ts lives at <root>/src/api/server.ts — three levels up reaches <root>.
const PROJECT_ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const SCENARIOS_ROOT = path.join(PROJECT_ROOT, 'scenarios');
const UPLOADS_ROOT = path.join(PROJECT_ROOT, 'tmp', 'uploads');
const PORT = Number(process.env.PORT ?? 4000);
// testcase (the pnpm/ccbp-jest-reporter harness) is structurally identical across every
// scenario — see InMemoryAnalysisJobService's doc comment — so it's a fixed server-side
// template rather than something re-uploaded per run. Bundled inside the repo (rather than
// pointing outside it) so a deploy of just this repo has everything it needs; override via
// DEFAULT_BASE_TESTCASE if a given environment should use a different base package.
const DEFAULT_BASE_TESTCASE = process.env.DEFAULT_BASE_TESTCASE
    ? path.resolve(process.env.DEFAULT_BASE_TESTCASE)
    : path.resolve(PROJECT_ROOT, 'templates', 'default-testcase');
await fs.mkdir(UPLOADS_ROOT, { recursive: true });
const compositionRoot = CompositionRoot.create('info');
const scenarioSpecRepository = new FileSystemScenarioSpecRepository(SCENARIOS_ROOT);
const generationJobService = new InMemoryGenerationJobService(compositionRoot);
const analysisJobService = new InMemoryAnalysisJobService(compositionRoot, SCENARIOS_ROOT, DEFAULT_BASE_TESTCASE);
const modelCatalogsByProvider = {
    anthropic: new AnthropicModelCatalogService(),
    openai: new OpenAiModelCatalogService(),
    openrouter: new OpenRouterModelCatalogService(),
    mistral: new MistralModelCatalogService(),
};
// Node treats an unhandled promise rejection as fatal by default — without this, any route
// handler that let a rejection escape would kill the whole server mid-response, and the
// browser would see a truncated body ("Unexpected end of JSON input") instead of a clean
// error. Every route handler should already catch its own errors (see modelRoutes.ts); this
// is the last-resort net for whatever one doesn't.
process.on('unhandledRejection', (reason) => {
    compositionRoot.logger.error('Unhandled promise rejection', { reason: String(reason) });
});
process.on('uncaughtException', (error) => {
    compositionRoot.logger.error('Uncaught exception', { error: error.message, stack: error.stack });
});
const app = express();
app.use(cors());
app.use(express.json());
app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
});
app.use('/api', buildScenarioRoutes(scenarioSpecRepository));
app.use('/api', buildGenerationRoutes(generationJobService));
app.use('/api', buildAnalysisRoutes(analysisJobService, UPLOADS_ROOT));
app.use('/api', buildModelRoutes(modelCatalogsByProvider));
app.use('/api', buildAnalysisSessionRoutes(SCENARIOS_ROOT, analysisJobService));
app.use((_request, response) => {
    response.status(404).json({ error: 'Not found' });
});
// Catches errors forwarded via next(err) — e.g. multer's fileFilter rejection, or a malformed
// JSON body — so the client always gets a clean JSON error instead of Express's default HTML
// error page (which would itself fail response.json() on the frontend). Must declare all four
// params for Express to recognize this as error-handling middleware, even though `_next` is unused.
app.use((error, _request, response, _next) => {
    compositionRoot.logger.error('Unhandled request error', { error: error instanceof Error ? error.message : String(error) });
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
});
app.listen(PORT, () => {
    compositionRoot.logger.info(`replica-generator API listening on http://localhost:${PORT}`);
});
