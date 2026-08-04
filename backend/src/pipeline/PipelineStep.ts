import type { PipelineContext } from './PipelineContext.js';

/**
 * One stage of the generation pipeline. Steps are executed strictly in the
 * order the orchestrator registers them in — see GENERATION_RULES.md's
 * "Test file workflow (order matters)" section, which this interface exists
 * to enforce structurally rather than by convention.
 */
export interface PipelineStep {
  readonly name: string;
  execute(context: PipelineContext): Promise<void>;
}
