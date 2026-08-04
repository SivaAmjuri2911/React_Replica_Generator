import { Router } from 'express';
import multer from 'multer';
import type { AnalysisJobService } from '../services/AnalysisJobService.js';
import type { PlatformMetadata } from '../../domain/models/ScenarioSpec.js';
import type { LlmProvider } from '../../domain/models/LlmProvider.js';

interface StartAnalysisFields {
  readonly scenarioSlug?: string;
  readonly description?: string;
  readonly provider?: string;
  readonly apiKey?: string;
  readonly modelId?: string;
  readonly contentType?: string;
  readonly toughness?: string;
  readonly language?: string;
  readonly questionType?: string;
  readonly questionFormat?: string;
}

const VALID_PROVIDERS: readonly LlmProvider[] = ['anthropic', 'openai', 'openrouter'];

function isLlmProvider(value: string): value is LlmProvider {
  return (VALID_PROVIDERS as readonly string[]).includes(value);
}

const ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
]);

function buildUpload(uploadsDir: string): multer.Multer {
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

export function buildAnalysisRoutes(jobService: AnalysisJobService, uploadsDir: string): Router {
  const router = Router();
  const upload = buildUpload(uploadsDir);

  const uploadFields = upload.fields([
    { name: 'prefilledCode', maxCount: 1 },
    { name: 'solutionCode', maxCount: 1 },
    { name: 'testcase', maxCount: 1 },
  ]);

  router.post('/analyses', uploadFields, async (request, response) => {
    const files = request.files as Record<string, Express.Multer.File[]> | undefined;
    const prefilledCodeFile = files?.prefilledCode?.[0];
    const solutionCodeFile = files?.solutionCode?.[0];
    const testcaseFile = files?.testcase?.[0];

    if (!prefilledCodeFile || !solutionCodeFile) {
      response.status(400).json({
        error: 'Both zip files are required: "prefilledCode", "solutionCode"',
      });
      return;
    }

    const body = request.body as StartAnalysisFields;
    if (!body.apiKey || body.apiKey.trim().length === 0) {
      response.status(400).json({ error: '"apiKey" is required and must be a non-empty string' });
      return;
    }
    if (body.provider !== undefined && !isLlmProvider(body.provider)) {
      response.status(400).json({ error: `"provider" must be one of: ${VALID_PROVIDERS.join(', ')}` });
      return;
    }

    const platformMetadata: PlatformMetadata = {
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
    } catch (error) {
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

  return router;
}
