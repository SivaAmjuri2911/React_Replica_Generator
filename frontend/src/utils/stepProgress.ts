import type { GenerationLogLine, ProgressStepDto } from '../types.js';
import type { StepTrackerItem } from '../components/StepTracker.js';

/**
 * The backend tags per-file progress lines with a fixed "Processing file: X" substring
 * (see TransformSolutionCodeStep/ScaffoldPrefilledCodeStep) — but CapturingLogger prepends a
 * scope like "[job:TransformSolutionCodeStep] " in front of it, so this must search for the
 * substring rather than anchor to the start of the message.
 */
const PROCESSING_FILE_PATTERN = /Processing file: (.+)$/;

/** Newest log line that looks like a per-file progress line, if any — used as the "currently: X" subtext under the active step. */
export function currentFileForStep(logs: readonly GenerationLogLine[]): string | undefined {
  for (let index = logs.length - 1; index >= 0; index--) {
    const match = logs[index]!.message.match(PROCESSING_FILE_PATTERN);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * Turns backend step/phase progress + the raw log array into what StepTracker renders.
 * Works unmodified for draft phases too — their log lines simply never match
 * PROCESSING_FILE_PATTERN, so `currentDetail` naturally stays undefined there.
 */
export function toStepTrackerItems(
  steps: readonly ProgressStepDto[] | undefined,
  logs: readonly GenerationLogLine[]
): readonly StepTrackerItem[] {
  if (!steps) {
    return [];
  }
  return steps.map((step) => ({
    key: step.name,
    label: step.label,
    status: step.status,
    currentDetail: step.status === 'running' ? currentFileForStep(logs) : undefined,
  }));
}
