import type { GeneratedProject } from './GeneratedProject.js';

export type GenerationJobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface GenerationLogLine {
  readonly timestamp: string;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly message: string;
}

export interface GenerationJobFailure {
  readonly code: string;
  readonly message: string;
  readonly context: Readonly<Record<string, unknown>>;
}

export type GenerationStepStatus = 'pending' | 'running' | 'succeeded' | 'failed';

/**
 * Live progress for one PipelineStep, as surfaced to the API/UI. `name` is
 * the internal PipelineStep.name (e.g. "TransformSolutionCodeStep"); `label`
 * is the friendly, human-readable text resolved server-side via
 * progressLabels.ts — the UI never has to translate internal names itself.
 */
export interface GenerationStepProgress {
  readonly name: string;
  readonly label: string;
  readonly status: GenerationStepStatus;
  readonly startedAt?: string;
  readonly finishedAt?: string;
}

/**
 * Tracks one asynchronous generation run so an HTTP client can poll for
 * progress instead of holding a connection open for the whole pipeline
 * (which can take 30-60+ seconds due to npm install/test).
 */
export interface GenerationJob {
  readonly id: string;
  readonly specPath: string;
  readonly scenarioName: string;
  readonly status: GenerationJobStatus;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly logs: readonly GenerationLogLine[];
  readonly result?: GeneratedProject;
  readonly failure?: GenerationJobFailure;
  /** Set only when this job ran under self-correction — how many attempts (initial + revisions) it took to pass. */
  readonly attemptsUsed?: number;
  /** Live per-step progress through the 10-step GenerationPipeline. Reset to all-pending at the start of every attempt (see GenerationPipeline's 'pipeline-start' event). */
  readonly steps?: readonly GenerationStepProgress[];
}
