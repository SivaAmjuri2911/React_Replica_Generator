import type { AnalysisJob } from '../../domain/models/AnalysisJob.js';
import type { PlatformMetadata } from '../../domain/models/ScenarioSpec.js';
import type { LlmProvider } from '../../domain/models/LlmProvider.js';

export interface StartAnalysisJobRequest {
  /** Folder name under scenarios/. Auto-derived from the job id when omitted — see InMemoryAnalysisJobService. */
  readonly scenarioSlug?: string;
  /** Omit to let the model invent an appropriate new scenario itself from the uploaded project alone. */
  readonly scenarioDescription?: string;
  readonly platformMetadata: PlatformMetadata;
  /** Absolute paths to the uploaded zip files, already saved to disk by the upload middleware. */
  readonly prefilledCodeZipPath: string;
  readonly solutionCodeZipPath: string;
  /** Omitted when the operator relies on the server's configured default testcase folder instead of uploading one — see InMemoryAnalysisJobService. */
  readonly testcaseZipPath?: string;
  /** Which vendor to draft with. Defaults to 'anthropic' when omitted. */
  readonly provider?: LlmProvider;
  /** Caller-supplied API key for the chosen provider, forwarded to the LLM call. */
  readonly apiKey: string;
  /** Which model to draft with. */
  readonly modelId?: string;
}

export interface AnalysisJobService {
  /** Extracts the uploads, drafts a spec via the chosen LLM provider, and returns the job id immediately. */
  startJob(request: StartAnalysisJobRequest): Promise<string>;
  getJob(jobId: string): AnalysisJob | undefined;
  listJobs(): readonly AnalysisJob[];
}
