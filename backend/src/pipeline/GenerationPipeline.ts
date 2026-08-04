import type { PipelineStep } from './PipelineStep.js';
import { PipelineContext } from './PipelineContext.js';
import type { ScenarioSpec } from '../domain/models/ScenarioSpec.js';
import type { GeneratedProject } from '../domain/models/GeneratedProject.js';
import { PipelineStepError, GenerationError } from '../domain/errors/GenerationError.js';
import type { Logger } from '../logging/Logger.js';

/**
 * Structured progress events emitted alongside (not instead of) the existing
 * free-text log lines — consumers that want a "step N of M, live" UI (see
 * InMemoryGenerationJobService) subscribe via `run()`'s optional `onProgress`
 * callback instead of parsing log message text. 'pipeline-start' fires once
 * per `run()` call, including every retry attempt under self-correction —
 * consumers use it as the reset signal to wipe stale step state from a
 * previous failed attempt.
 */
export type PipelineProgressEvent =
  | { readonly type: 'pipeline-start' }
  | { readonly type: 'step-start'; readonly stepName: string }
  | { readonly type: 'step-complete'; readonly stepName: string }
  | { readonly type: 'step-failed'; readonly stepName: string; readonly error: unknown };

export type PipelineProgressListener = (event: PipelineProgressEvent) => void;

/**
 * Orchestrates an ordered list of PipelineStep instances against a shared
 * PipelineContext. Adding a new step means adding it to the array passed
 * into the constructor — no existing step needs to change (open/closed).
 */
export class GenerationPipeline {
  private readonly steps: readonly PipelineStep[];
  private readonly logger: Logger;

  constructor(steps: readonly PipelineStep[], logger: Logger) {
    this.steps = steps;
    this.logger = logger.child('GenerationPipeline');
  }

  /** The ordered step names this pipeline will run — used to keep progressLabels.ts in sync (see its test). */
  get stepNames(): readonly string[] {
    return this.steps.map((step) => step.name);
  }

  async run(spec: ScenarioSpec, onProgress?: PipelineProgressListener): Promise<GeneratedProject> {
    const context = new PipelineContext(spec);
    onProgress?.({ type: 'pipeline-start' });

    for (const step of this.steps) {
      this.logger.info(`Running step: ${step.name}`);
      onProgress?.({ type: 'step-start', stepName: step.name });
      try {
        await step.execute(context);
      } catch (cause) {
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

  private toGeneratedProject(context: PipelineContext): GeneratedProject {
    const missing = (
      ['prefilledCodePath', 'solutionCodePath', 'testcasePath', 'ideBasedCodingJsonPath', 'testCases', 'questionId', 'ideSessionId'] as const
    ).filter((key) => context[key] === undefined);

    if (missing.length > 0) {
      throw new PipelineStepError(
        'GenerationPipeline',
        new Error(`Pipeline completed without populating: ${missing.join(', ')}`)
      );
    }

    return {
      scenarioName: context.spec.scenarioName,
      prefilledCodePath: context.prefilledCodePath as string,
      solutionCodePath: context.solutionCodePath as string,
      testcasePath: context.testcasePath as string,
      ideBasedCodingJsonPath: context.ideBasedCodingJsonPath as string,
      testCases: context.testCases as GeneratedProject['testCases'],
      questionId: context.questionId as string,
      ideSessionId: context.ideSessionId as string,
    };
  }
}
