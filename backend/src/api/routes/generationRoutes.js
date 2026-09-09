import path from 'node:path';
import { Router } from 'express';
import { AdmZipZipCreationService } from '../../services/archive/AdmZipZipCreationService.js';

/**
 * @typedef {object} StartGenerationRequestBody
 * @property {unknown} [specPath]
 * @property {unknown} [provider] Presence of a non-empty apiKey opts this run into self-correction — see SelfCorrectingScenarioWorkflow.
 * @property {unknown} [apiKey]
 * @property {unknown} [modelId]
 * @property {unknown} [maxAttempts]
 */

const VALID_PROVIDERS = ['anthropic', 'openai', 'openrouter', 'mistral'];
function isLlmProvider(value) {
    return typeof value === 'string' && VALID_PROVIDERS.includes(value);
}
/**
 * Bundles all four output pieces into one archive instead of four separate
 * downloads — prefilled_code / solution_code / testcase each keep their own
 * top-level folder name (matching the on-disk convention), and the JSON goes
 * under "output/IDE_BASED_CODING/{uuid}.json" alongside the three scenario folders. Built
 * on demand (never cached) since the output directory can still be touched
 * (e.g. re-validated) between polls — the download always reflects whatever
 * is on disk right now.
 */
async function buildCombinedDownloadZip(zipCreation, result) {
    const entries = [
        { type: 'directory', sourcePath: result.prefilledCodePath, archiveFolderName: path.basename(result.prefilledCodePath) },
        { type: 'directory', sourcePath: result.solutionCodePath, archiveFolderName: path.basename(result.solutionCodePath) },
        { type: 'directory', sourcePath: result.testcasePath, archiveFolderName: path.basename(result.testcasePath) },
        { type: 'file', sourcePath: result.ideBasedCodingJsonPath, archiveFolderName: path.join('output', 'IDE_BASED_CODING') },
    ];
    const zip = await zipCreation.zipBundle(entries);
    if (!zip.ok) {
        return { error: zip.error.message };
    }
    // The scenario's own folder-base name (e.g. "TourDepartureManagement") — same name every
    // output folder is already built from, so the zip's own name matches what's inside it.
    const scenarioFolderName = path.basename(result.prefilledCodePath);
    return { filename: `${scenarioFolderName}.zip`, buffer: zip.value };
}
export function buildGenerationRoutes(jobService, zipCreation = new AdmZipZipCreationService()) {
    const router = Router();
    router.post('/generations', async (request, response) => {
        const body = request.body;
        if (typeof body.specPath !== 'string' || body.specPath.trim().length === 0) {
            response.status(400).json({ error: '"specPath" is required and must be a non-empty string' });
            return;
        }
        if (body.provider !== undefined && !isLlmProvider(body.provider)) {
            response.status(400).json({ error: `"provider" must be one of: ${VALID_PROVIDERS.join(', ')}` });
            return;
        }
        const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
        const selfCorrect = apiKey.length > 0
            ? {
                apiKey,
                ...(isLlmProvider(body.provider) ? { provider: body.provider } : {}),
                ...(typeof body.modelId === 'string' && body.modelId.length > 0 ? { modelId: body.modelId } : {}),
                ...(typeof body.maxAttempts === 'number' ? { maxAttempts: body.maxAttempts } : {}),
            }
            : undefined;
        try {
            const jobId = await jobService.startJob(body.specPath, selfCorrect);
            response.status(202).json({ jobId });
        }
        catch (error) {
            response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
        }
    });
    router.get('/generations', (_request, response) => {
        response.json({ jobs: jobService.listJobs() });
    });
    router.get('/generations/:jobId', (request, response) => {
        const job = jobService.getJob(request.params.jobId);
        if (!job) {
            response.status(404).json({ error: `No job found with id "${request.params.jobId}"` });
            return;
        }
        response.json({ job });
    });
    router.delete('/generations/:jobId', (request, response) => {
        try {
            const deleted = jobService.deleteJob(request.params.jobId);
            if (!deleted) {
                response.status(404).json({ error: `No job found with id "${request.params.jobId}"` });
                return;
            }
            response.status(204).send();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const status = message.includes('still running') ? 409 : 500;
            response.status(status).json({ error: message });
        }
    });
    router.get('/generations/:jobId/download', async (request, response) => {
        const job = jobService.getJob(request.params.jobId);
        if (!job) {
            response.status(404).json({ error: `No job found with id "${request.params.jobId}"` });
            return;
        }
        if (job.status !== 'succeeded' || !job.result) {
            response.status(400).json({ error: `Job "${request.params.jobId}" has not succeeded yet` });
            return;
        }
        const built = await buildCombinedDownloadZip(zipCreation, job.result);
        if ('error' in built) {
            response.status(500).json({ error: built.error });
            return;
        }
        response.setHeader('Content-Type', 'application/zip');
        response.setHeader('Content-Disposition', `attachment; filename="${built.filename}"`);
        response.send(built.buffer);
    });
    return router;
}
