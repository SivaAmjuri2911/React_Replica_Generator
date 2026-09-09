/**
 * @typedef {object} StartAnalysisJobRequest
 * @property {string} [scenarioSlug] Folder name under scenarios/. Auto-derived from the job id when omitted — see InMemoryAnalysisJobService.
 * @property {string} [scenarioDescription] Omit to let the model invent an appropriate new scenario itself from the uploaded project alone.
 * @property {import('../../domain/models/ScenarioSpec.js').PlatformMetadata} platformMetadata
 * @property {string} prefilledCodeZipPath Absolute paths to the uploaded zip files, already saved to disk by the upload middleware.
 * @property {string} solutionCodeZipPath
 * @property {string} [testcaseZipPath] Omitted when the operator relies on the server's configured default testcase folder instead of uploading one — see InMemoryAnalysisJobService.
 * @property {import('../../domain/models/LlmProvider.js').LlmProvider} [provider] Which vendor to draft with. Defaults to 'anthropic' when omitted.
 * @property {string} apiKey Caller-supplied API key for the chosen provider, forwarded to the LLM call.
 * @property {string} [modelId] Which model to draft with.
 */

/**
 * @typedef {object} AnalysisJobService
 * @property {(request: StartAnalysisJobRequest) => Promise<string>} startJob Extracts the uploads, drafts a spec via the chosen LLM provider, and returns the job id immediately.
 * @property {(jobId: string) => (import('../../domain/models/AnalysisJob.js').AnalysisJob | undefined)} getJob
 * @property {() => readonly import('../../domain/models/AnalysisJob.js').AnalysisJob[]} listJobs
 */

export {};
