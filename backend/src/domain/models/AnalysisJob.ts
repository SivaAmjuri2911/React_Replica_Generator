import type { GenerationLogLine } from './GenerationJob.js';
import type { ScenarioSpec } from './ScenarioSpec.js';

export type AnalysisJobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface AnalysisJobFailure {
  readonly code: string;
  readonly message: string;
  readonly context: Readonly<Record<string, unknown>>;
}

/**
 * The draft flow has no PipelineStep[] array to hook into like generation
 * does — these four names are manually-instrumented milestones matching the
 * real control flow across InMemoryAnalysisJobService.runJob() and
 * ScenarioSpecAuthoringWorkflow (see progressLabels.ts for their labels).
 */
export type AnalysisPhaseName = 'extracting-uploads' | 'reading-solution-code' | 'drafting-with-model' | 'saving-spec';
export type AnalysisPhaseStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface AnalysisPhaseProgress {
  readonly name: AnalysisPhaseName;
  readonly label: string;
  readonly status: AnalysisPhaseStatus;
  readonly startedAt?: string;
  readonly finishedAt?: string;
}

export type AnalysisPhaseEvent =
  | { readonly type: 'phase-start'; readonly phase: AnalysisPhaseName }
  | { readonly type: 'phase-complete'; readonly phase: AnalysisPhaseName }
  | { readonly type: 'phase-failed'; readonly phase: AnalysisPhaseName; readonly error: unknown };

export type AnalysisPhaseListener = (event: AnalysisPhaseEvent) => void;

/**
 * Tracks one asynchronous spec-drafting run (upload -> extract -> Claude
 * call -> spec.json) so an HTTP client can poll instead of holding a
 * connection open for the whole thing. Mirrors GenerationJob's shape
 * deliberately — same polling UX on the frontend for both job types.
 */
export interface AnalysisJob {
  readonly id: string;
  readonly scenarioSlug: string;
  readonly status: AnalysisJobStatus;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly logs: readonly GenerationLogLine[];
  readonly result?: ScenarioSpec;
  readonly specPath?: string;
  readonly failure?: AnalysisJobFailure;
  /** Live progress through the four draft milestones (see AnalysisPhaseName). */
  readonly phases?: readonly AnalysisPhaseProgress[];
}
