/**
 * One stage of the generation pipeline. Steps are executed strictly in the
 * order the orchestrator registers them in — see GENERATION_RULES.md's
 * "Test file workflow (order matters)" section, which this interface exists
 * to enforce structurally rather than by convention.
 * @typedef {object} PipelineStep
 * @property {string} name
 * @property {(context: import('./PipelineContext.js').PipelineContext) => Promise<void>} execute
 */

export {};
