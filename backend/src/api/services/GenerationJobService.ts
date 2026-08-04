import type { GenerationJob } from '../../domain/models/GenerationJob.js';
import type { LlmProvider } from '../../domain/models/LlmProvider.js';

export interface SelfCorrectionOptions {
  readonly provider?: LlmProvider;
  readonly apiKey: string;
  readonly modelId?: string;
  readonly maxAttempts?: number;
}

export interface GenerationJobService {
  /**
   * Starts a generation run in the background and returns its job id
   * immediately. Without `selfCorrect`, this is the original one-shot,
   * fully-deterministic pipeline run. With it, a failing run's real test
   * output gets fed back to the LLM for a revised draft and retried (up to
   * `selfCorrect.maxAttempts`) instead of failing outright on the first bug
   * in the drafted test file.
   */
  startJob(specPath: string, selfCorrect?: SelfCorrectionOptions): Promise<string>;
  getJob(jobId: string): GenerationJob | undefined;
  listJobs(): readonly GenerationJob[];
}
