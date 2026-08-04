import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { GenerationJobService, SelfCorrectionOptions } from './GenerationJobService.js';
import type { GenerationJob, GenerationLogLine, GenerationStepProgress } from '../../domain/models/GenerationJob.js';
import type { PipelineProgressListener } from '../../pipeline/GenerationPipeline.js';
import type { CompositionRoot } from '../../config/CompositionRoot.js';
import { ScenarioSpecLoader } from '../../config/ScenarioSpecLoader.js';
import { FileSystemScenarioSpecRepository } from '../../config/FileSystemScenarioSpecRepository.js';
import { CapturingLogger } from '../../logging/CapturingLogger.js';
import { GenerationError } from '../../domain/errors/GenerationError.js';
import { reconstructDraftFromSpec } from '../../authoring/reconstructDraftFromSpec.js';
import { GENERATION_STEP_LABELS } from '../../config/progressLabels.js';

/**
 * Runs generations in the background inside the same Node process and
 * tracks their progress in memory. Adequate for a single-operator tool
 * (matches how this project is actually used — one person, one machine);
 * would need a persistent/queued store to support multiple concurrent
 * operators or survive a server restart, which is explicitly out of scope
 * until that's an actual requirement.
 */
export class InMemoryGenerationJobService implements GenerationJobService {
  private readonly jobs = new Map<string, GenerationJob>();
  private readonly compositionRoot: CompositionRoot;
  private readonly specLoader: ScenarioSpecLoader;

  constructor(compositionRoot: CompositionRoot, specLoader: ScenarioSpecLoader = new ScenarioSpecLoader()) {
    this.compositionRoot = compositionRoot;
    this.specLoader = specLoader;
  }

  async startJob(specPath: string, selfCorrect?: SelfCorrectionOptions): Promise<string> {
    const spec = await this.specLoader.loadFromFile(specPath);
    const jobId = randomUUID();
    const logs: GenerationLogLine[] = [];

    const job: GenerationJob = {
      id: jobId,
      specPath,
      scenarioName: spec.scenarioName,
      status: 'pending',
      startedAt: new Date().toISOString(),
      logs,
      steps: GENERATION_STEP_LABELS.map((step) => ({ name: step.name, label: step.label, status: 'pending' })),
    };
    this.jobs.set(jobId, job);

    void this.runJob(jobId, specPath, logs, selfCorrect);

    return jobId;
  }

  getJob(jobId: string): GenerationJob | undefined {
    return this.jobs.get(jobId);
  }

  listJobs(): readonly GenerationJob[] {
    return [...this.jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  private async runJob(
    jobId: string,
    specPath: string,
    logs: GenerationLogLine[],
    selfCorrect: SelfCorrectionOptions | undefined
  ): Promise<void> {
    this.updateJob(jobId, { status: 'running' });

    const jobLogger = new CapturingLogger(this.compositionRoot.logger, (line) => logs.push(line), 'job');

    const steps: GenerationStepProgress[] = GENERATION_STEP_LABELS.map((step) => ({
      name: step.name,
      label: step.label,
      status: 'pending',
    }));
    const onProgress: PipelineProgressListener = (event) => {
      const now = new Date().toISOString();
      if (event.type === 'pipeline-start') {
        // Fires at the top of every pipeline.run() call, including every retry attempt under
        // self-correction — wipe stale state from a previous failed attempt back to pending.
        // exactOptionalPropertyTypes forbids `startedAt: undefined` — build a fresh object
        // that omits the keys entirely instead of spreading and nulling them out.
        for (let index = 0; index < steps.length; index++) {
          const { name, label } = steps[index]!;
          steps[index] = { name, label, status: 'pending' };
        }
        this.updateJob(jobId, { steps: [...steps] });
        return;
      }
      const index = steps.findIndex((step) => step.name === event.stepName);
      if (index < 0) {
        return;
      }
      if (event.type === 'step-start') {
        const { name, label } = steps[index]!;
        steps[index] = { name, label, status: 'running', startedAt: now };
      } else if (event.type === 'step-complete') {
        steps[index] = { ...steps[index]!, status: 'succeeded', finishedAt: now };
      } else {
        steps[index] = { ...steps[index]!, status: 'failed', finishedAt: now };
      }
      this.updateJob(jobId, { steps: [...steps] });
    };

    try {
      const spec = await this.specLoader.loadFromFile(specPath);

      if (selfCorrect) {
        // scenarios/{slug}/spec.json — see FileSystemScenarioSpecRepository's own convention.
        const scenariosRoot = path.dirname(path.dirname(specPath));
        const fileSystem = this.compositionRoot.fileSystem;

        const draftResult = await reconstructDraftFromSpec(fileSystem, spec);
        if (!draftResult.ok) {
          throw draftResult.error;
        }

        const usedTestPrefixes = (await new FileSystemScenarioSpecRepository(scenariosRoot).listAvailable()).map(
          (scenario) => scenario.testPrefix
        );

        const workflow = this.compositionRoot.buildSelfCorrectingScenarioWorkflow(jobLogger);
        const workflowResult = await workflow.run(
          {
            initialDraft: draftResult.value,
            platformMetadata: spec.platformMetadata,
            usedTestPrefixes,
            basePrefilledCode: spec.paths.basePrefilledCode,
            baseSolutionCode: spec.paths.baseSolutionCode,
            baseTestcase: spec.paths.baseTestcase,
            ideBasedCodingOutputDir: spec.paths.ideBasedCodingOutputDir,
            outputRoot: spec.paths.outputRoot,
            stagingDir: spec.paths.stagingDir,
            specOutputPath: specPath,
            ...(selfCorrect.provider ? { provider: selfCorrect.provider } : {}),
            apiKey: selfCorrect.apiKey,
            ...(selfCorrect.modelId ? { modelId: selfCorrect.modelId } : {}),
            ...(selfCorrect.maxAttempts ? { maxAttempts: selfCorrect.maxAttempts } : {}),
          },
          onProgress
        );

        if (!workflowResult.ok) {
          throw workflowResult.error;
        }

        this.updateJob(jobId, {
          status: 'succeeded',
          finishedAt: new Date().toISOString(),
          result: workflowResult.value.generatedProject,
          attemptsUsed: workflowResult.value.attemptsUsed,
        });
        return;
      }

      const pipeline = this.compositionRoot.buildGenerationPipeline(jobLogger);
      const result = await pipeline.run(spec, onProgress);

      this.updateJob(jobId, {
        status: 'succeeded',
        finishedAt: new Date().toISOString(),
        result,
      });
    } catch (error) {
      const failure = error instanceof GenerationError
        ? { code: error.code, message: error.message, context: error.context }
        : { code: 'UNEXPECTED_ERROR', message: String(error), context: {} };

      // Whichever step was running (or the first pending one, if nothing ever started —
      // e.g. spec reload/reconstruction failed before the pipeline began) never got its own
      // step-failed event from GenerationPipeline — mark it so the UI doesn't show a spinner
      // spinning forever on a job that has already stopped.
      const now = new Date().toISOString();
      const stalledIndex = steps.findIndex((step) => step.status === 'running');
      const fallbackIndex = stalledIndex >= 0 ? stalledIndex : steps.findIndex((step) => step.status === 'pending');
      if (fallbackIndex >= 0) {
        steps[fallbackIndex] = { ...steps[fallbackIndex]!, status: 'failed', finishedAt: now };
      }

      this.updateJob(jobId, {
        status: 'failed',
        finishedAt: now,
        failure,
        steps: [...steps],
      });
    }
  }

  private updateJob(jobId: string, patch: Partial<GenerationJob>): void {
    const existing = this.jobs.get(jobId);
    if (!existing) {
      return;
    }
    this.jobs.set(jobId, { ...existing, ...patch });
  }
}
