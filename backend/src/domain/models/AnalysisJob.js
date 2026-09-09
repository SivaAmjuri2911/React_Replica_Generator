/**
 * @typedef {('pending'|'running'|'succeeded'|'failed')} AnalysisJobStatus
 */

/**
 * @typedef {object} AnalysisJobFailure
 * @property {string} code
 * @property {string} message
 * @property {Readonly<Record<string, unknown>>} context
 */

/**
 * The draft flow has no PipelineStep[] array to hook into like generation
 * does — these four names are manually-instrumented milestones matching the
 * real control flow across InMemoryAnalysisJobService.runJob() and
 * ScenarioSpecAuthoringWorkflow (see progressLabels.ts for their labels).
 * @typedef {('extracting-uploads'|'reading-solution-code'|'drafting-with-model'|'saving-spec')} AnalysisPhaseName
 */

/**
 * @typedef {('pending'|'running'|'succeeded'|'failed')} AnalysisPhaseStatus
 */

/**
 * @typedef {object} AnalysisPhaseProgress
 * @property {AnalysisPhaseName} name
 * @property {string} label
 * @property {AnalysisPhaseStatus} status
 * @property {string} [startedAt]
 * @property {string} [finishedAt]
 */

/**
 * @typedef {(
 *   {type: 'phase-start', phase: AnalysisPhaseName} |
 *   {type: 'phase-complete', phase: AnalysisPhaseName} |
 *   {type: 'phase-failed', phase: AnalysisPhaseName, error: unknown}
 * )} AnalysisPhaseEvent
 */

/**
 * @typedef {(event: AnalysisPhaseEvent) => void} AnalysisPhaseListener
 */

/**
 * Tracks one asynchronous spec-drafting run (upload -> extract -> Claude
 * call -> spec.json) so an HTTP client can poll instead of holding a
 * connection open for the whole thing. Mirrors GenerationJob's shape
 * deliberately — same polling UX on the frontend for both job types.
 * @typedef {object} AnalysisJob
 * @property {string} id
 * @property {string} scenarioSlug
 * @property {AnalysisJobStatus} status
 * @property {string} startedAt
 * @property {string} [finishedAt]
 * @property {readonly import('./GenerationJob.js').GenerationLogLine[]} logs
 * @property {import('./ScenarioSpec.js').ScenarioSpec} [result]
 * @property {string} [specPath]
 * @property {AnalysisJobFailure} [failure]
 * @property {readonly AnalysisPhaseProgress[]} [phases] Live progress through the four draft milestones (see AnalysisPhaseName).
 */

export {};
