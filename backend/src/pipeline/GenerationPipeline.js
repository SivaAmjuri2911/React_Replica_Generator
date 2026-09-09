import { PipelineContext } from './PipelineContext.js';
import { PipelineStepError, GenerationError } from '../domain/errors/GenerationError.js';

/**
 * Structured progress events emitted alongside (not instead of) the existing
 * free-text log lines — consumers that want a "step N of M, live" UI (see
 * InMemoryGenerationJobService) subscribe via `run()`'s optional `onProgress`
 * callback instead of parsing log message text.
 * @typedef {(
 *   {type: 'pipeline-start'} |
 *   {type: 'step-start', stepName: string} |
 *   {type: 'step-complete', stepName: string} |
 *   {type: 'step-failed', stepName: string, error: unknown}
 * )} PipelineProgressEvent
 */

/**
 * @typedef {(event: PipelineProgressEvent) => void} PipelineProgressListener
 */

/**
 * Orchestrates an ordered list of PipelineStep instances against a shared
 * PipelineContext. Adding a new step means adding it to the array passed
 * into the constructor — no existing step needs to change (open/closed).
 */
export class GenerationPipeline {
    steps;
    logger;
    constructor(steps, logger) {
        this.steps = steps;
        this.logger = logger.child('GenerationPipeline');
    }
    /** The ordered step names this pipeline will run — used to keep progressLabels.ts in sync (see its test). */
    get stepNames() {
        return this.steps.map((step) => step.name);
    }
    async run(spec, onProgress) {
        const context = new PipelineContext(spec);
        onProgress?.({ type: 'pipeline-start' });
        for (const step of this.steps) {
            this.logger.info(`Running step: ${step.name}`);
            onProgress?.({ type: 'step-start', stepName: step.name });
            try {
                await step.execute(context);
            }
            catch (cause) {
                onProgress?.({ type: 'step-failed', stepName: step.name, error: cause });
                if (cause instanceof GenerationError) {
                    throw cause;
                }
                throw new PipelineStepError(step.name, cause);
            }
            this.logger.info(`Completed step: ${step.name}`);
            onProgress?.({ type: 'step-complete', stepName: step.name });
        }
        return this.toGeneratedProject(context);
    }
    toGeneratedProject(context) {
        const missing = ['prefilledCodePath', 'solutionCodePath', 'testcasePath', 'ideBasedCodingJsonPath', 'testCases', 'questionId', 'ideSessionId'].filter((key) => context[key] === undefined);
        if (missing.length > 0) {
            throw new PipelineStepError('GenerationPipeline', new Error(`Pipeline completed without populating: ${missing.join(', ')}`));
        }
        return {
            scenarioName: context.spec.scenarioName,
            prefilledCodePath: context.prefilledCodePath,
            solutionCodePath: context.solutionCodePath,
            testcasePath: context.testcasePath,
            ideBasedCodingJsonPath: context.ideBasedCodingJsonPath,
            testCases: context.testCases,
            questionId: context.questionId,
            ideSessionId: context.ideSessionId,
        };
    }
}
