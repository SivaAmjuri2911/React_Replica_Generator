/**
 * @typedef {object} SelfCorrectionOptions
 * @property {import('../../domain/models/LlmProvider.js').LlmProvider} [provider]
 * @property {string} apiKey
 * @property {string} [modelId]
 * @property {number} [maxAttempts]
 */

/**
 * @typedef {object} GenerationJobService
 * @property {(specPath: string, selfCorrect?: SelfCorrectionOptions) => Promise<string>} startJob Starts a generation run in the background and returns its job id immediately. Without `selfCorrect`, this is the original one-shot, fully-deterministic pipeline run. With it, a failing run's real test output gets fed back to the LLM for a revised draft and retried (up to `selfCorrect.maxAttempts`) instead of failing outright on the first bug in the drafted test file.
 * @property {(jobId: string) => (import('../../domain/models/GenerationJob.js').GenerationJob | undefined)} getJob
 * @property {() => readonly import('../../domain/models/GenerationJob.js').GenerationJob[]} listJobs
 */

export {};
