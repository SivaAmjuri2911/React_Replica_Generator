/**
 * @typedef {('pending'|'running'|'succeeded'|'failed')} GenerationJobStatus
 */

/**
 * @typedef {object} GenerationLogLine
 * @property {string} timestamp
 * @property {('debug'|'info'|'warn'|'error')} level
 * @property {string} message
 */

/**
 * @typedef {object} GenerationJobFailure
 * @property {string} code
 * @property {string} message
 * @property {Readonly<Record<string, unknown>>} context
 */

/**
 * @typedef {('pending'|'running'|'succeeded'|'failed')} GenerationStepStatus
 */

/**
 * Live progress for one PipelineStep, as surfaced to the API/UI. `name` is
 * the internal PipelineStep.name (e.g. "TransformSolutionCodeStep"); `label`
 * is the friendly, human-readable text resolved server-side via
 * progressLabels.ts — the UI never has to translate internal names itself.
 * @typedef {object} GenerationStepProgress
 * @property {string} name
 * @property {string} label
 * @property {GenerationStepStatus} status
 * @property {string} [startedAt]
 * @property {string} [finishedAt]
 */

/**
 * Tracks one asynchronous generation run so an HTTP client can poll for
 * progress instead of holding a connection open for the whole pipeline
 * (which can take 30-60+ seconds due to npm install/test).
 * @typedef {object} GenerationJob
 * @property {string} id
 * @property {string} specPath
 * @property {string} scenarioName
 * @property {GenerationJobStatus} status
 * @property {string} startedAt
 * @property {string} [finishedAt]
 * @property {readonly GenerationLogLine[]} logs
 * @property {import('./GeneratedProject.js').GeneratedProject} [result]
 * @property {GenerationJobFailure} [failure]
 * @property {number} [attemptsUsed] Set only when this job ran under self-correction — how many attempts (initial + revisions) it took to pass.
 * @property {readonly GenerationStepProgress[]} [steps] Live per-step progress through the 10-step GenerationPipeline. Reset to all-pending at the start of every attempt (see GenerationPipeline's 'pipeline-start' event).
 */

export {};
