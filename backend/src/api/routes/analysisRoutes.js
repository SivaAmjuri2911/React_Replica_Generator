import { Router } from 'express';
import multer from 'multer';

/**
 * @typedef {object} StartAnalysisFields
 * @property {string} [scenarioSlug]
 * @property {string} [description]
 * @property {string} [provider]
 * @property {string} [apiKey]
 * @property {string} [modelId]
 * @property {string} [contentType]
 * @property {string} [toughness]
 * @property {string} [language]
 * @property {string} [questionType]
 * @property {string} [questionFormat]
 */

const VALID_PROVIDERS = ['anthropic', 'openai', 'openrouter', 'mistral'];
function isLlmProvider(value) {
    return VALID_PROVIDERS.includes(value);
}
const ZIP_MIME_TYPES = new Set([
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
]);
function buildUpload(uploadsDir) {
    const storage = multer.diskStorage({
        destination: uploadsDir,
        filename: (_request, file, callback) => {
            callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`);
        },
    });
    return multer({
        storage,
        limits: { fileSize: 200 * 1024 * 1024 },
        fileFilter: (_request, file, callback) => {
            if (!file.originalname.toLowerCase().endsWith('.zip') && !ZIP_MIME_TYPES.has(file.mimetype)) {
                callback(new Error(`"${file.originalname}" is not a .zip file`));
                return;
            }
            callback(null, true);
        },
    });
}
export function buildAnalysisRoutes(jobService, uploadsDir) {
    const router = Router();
    const upload = buildUpload(uploadsDir);
    const uploadFields = upload.fields([
        { name: 'prefilledCode', maxCount: 1 },
        { name: 'solutionCode', maxCount: 1 },
        { name: 'testcase', maxCount: 1 },
    ]);
    router.post('/analyses', uploadFields, async (request, response) => {
        const files = request.files;
        const prefilledCodeFile = files?.prefilledCode?.[0];
        const solutionCodeFile = files?.solutionCode?.[0];
        const testcaseFile = files?.testcase?.[0];
        if (!prefilledCodeFile || !solutionCodeFile) {
            response.status(400).json({
                error: 'Both zip files are required: "prefilledCode", "solutionCode"',
            });
            return;
        }
        const body = request.body;
        if (!body.apiKey || body.apiKey.trim().length === 0) {
            response.status(400).json({ error: '"apiKey" is required and must be a non-empty string' });
            return;
        }
        if (body.provider !== undefined && !isLlmProvider(body.provider)) {
            response.status(400).json({ error: `"provider" must be one of: ${VALID_PROVIDERS.join(', ')}` });
            return;
        }
        const platformMetadata = {
            contentType: body.contentType ?? 'MARKDOWN',
            toughness: body.toughness ?? 'EASY',
            language: body.language ?? 'ENGLISH',
            questionType: body.questionType ?? 'IDE_BASED_CODING',
            questionFormat: body.questionFormat ?? 'CODING_PRACTICE',
        };
        try {
            const jobId = await jobService.startJob({
                ...(body.scenarioSlug ? { scenarioSlug: body.scenarioSlug } : {}),
                ...(body.description ? { scenarioDescription: body.description } : {}),
                platformMetadata,
                prefilledCodeZipPath: prefilledCodeFile.path,
                solutionCodeZipPath: solutionCodeFile.path,
                ...(testcaseFile ? { testcaseZipPath: testcaseFile.path } : {}),
                ...(body.provider ? { provider: body.provider } : {}),
                apiKey: body.apiKey,
                ...(body.modelId ? { modelId: body.modelId } : {}),
            });
            response.status(202).json({ jobId });
        }
        catch (error) {
            response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
        }
    });
    router.get('/analyses', (_request, response) => {
        response.json({ jobs: jobService.listJobs() });
    });
    router.get('/analyses/:jobId', (request, response) => {
        const job = jobService.getJob(request.params.jobId);
        if (!job) {
            response.status(404).json({ error: `No job found with id "${request.params.jobId}"` });
            return;
        }
        response.json({ job });
    });
    router.post('/analyses/:jobId/cancel', (request, response) => {
        const cancelled = jobService.cancelJob(request.params.jobId);
        if (!cancelled) {
            const job = jobService.getJob(request.params.jobId);
            if (!job) {
                response.status(404).json({ error: `No job found with id "${request.params.jobId}"` });
                return;
            }
            response.status(409).json({ error: 'Only pending or running design jobs can be cancelled' });
            return;
        }
        response.status(204).send();
    });
    router.delete('/analyses/:jobId', async (request, response) => {
        try {
            const deleted = await jobService.deleteJob(request.params.jobId);
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
    return router;
}
