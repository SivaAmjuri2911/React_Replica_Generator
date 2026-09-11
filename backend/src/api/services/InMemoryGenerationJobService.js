import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ScenarioSpecLoader } from '../../config/ScenarioSpecLoader.js';
import { FileSystemScenarioSpecRepository } from '../../config/FileSystemScenarioSpecRepository.js';
import { CapturingLogger } from '../../logging/CapturingLogger.js';
import { GenerationError } from '../../domain/errors/GenerationError.js';
import { reconstructDraftFromSpec } from '../../authoring/reconstructDraftFromSpec.js';
import { GENERATION_STEP_LABELS } from '../../config/progressLabels.js';
import { stopDevServersForProjectDir } from '../devServerRegistry.js';
import { writeGenerationSessionMeta } from './writeGenerationSessionMeta.js';
import { outputPrefilledCodePath, outputSolutionCodePath } from '../../domain/models/ScenarioSpec.js';
import { buildScenarioEvaluationSummary } from '../../services/evaluation/ScenarioEvaluationCatalog.js';
/**
 * Runs generations in the background inside the same Node process and
 * tracks their progress in memory. Adequate for a single-operator tool
 * (matches how this project is actually used — one person, one machine);
 * would need a persistent/queued store to support multiple concurrent
 * operators or survive a server restart, which is explicitly out of scope
 * until that's an actual requirement.
 */
/**
 * @implements {GenerationJobService}
 */
export class InMemoryGenerationJobService {
    jobs = new Map();
    compositionRoot;
    specLoader;
    constructor(compositionRoot, specLoader = new ScenarioSpecLoader()) {
        this.compositionRoot = compositionRoot;
        this.specLoader = specLoader;
    }
    async startJob(specPath, selfCorrect) {
        const spec = await this.specLoader.loadFromFile(specPath);
        const jobId = randomUUID();
        const logs = [];
        const job = {
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
    getJob(jobId) {
        return this.jobs.get(jobId);
    }
    listJobs() {
        return [...this.jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    }
    deleteJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return false;
        }
        if (job.status === 'pending' || job.status === 'running') {
            throw new Error('Cannot delete a project while it is still running');
        }
        this.jobs.delete(jobId);
        return true;
    }
    async runJob(jobId, specPath, logs, selfCorrect) {
        this.updateJob(jobId, { status: 'running' });
        const jobLogger = new CapturingLogger(this.compositionRoot.logger, (line) => logs.push(line), 'job');
        const steps = GENERATION_STEP_LABELS.map((step) => ({
            name: step.name,
            label: step.label,
            status: 'pending',
        }));
        const onProgress = (event) => {
            const now = new Date().toISOString();
            if (event.type === 'pipeline-start') {
                // Fires at the top of every pipeline.run() call, including every retry attempt under
                // self-correction — wipe stale state from a previous failed attempt back to pending.
                // exactOptionalPropertyTypes forbids `startedAt: undefined` — build a fresh object
                // that omits the keys entirely instead of spreading and nulling them out.
                for (let index = 0; index < steps.length; index++) {
                    const { name, label } = steps[index];
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
                const { name, label } = steps[index];
                steps[index] = { name, label, status: 'running', startedAt: now };
            }
            else if (event.type === 'step-complete') {
                steps[index] = { ...steps[index], status: 'succeeded', finishedAt: now };
            }
            else {
                steps[index] = { ...steps[index], status: 'failed', finishedAt: now };
            }
            this.updateJob(jobId, { steps: [...steps] });
        };
        try {
            const spec = await this.specLoader.loadFromFile(specPath);
            await stopDevServersForProjectDir(outputPrefilledCodePath(spec));
            await stopDevServersForProjectDir(outputSolutionCodePath(spec));
            if (selfCorrect) {
                // scenarios/{slug}/spec.json — see FileSystemScenarioSpecRepository's own convention.
                const scenariosRoot = path.dirname(path.dirname(specPath));
                const fileSystem = this.compositionRoot.fileSystem;
                const draftResult = await reconstructDraftFromSpec(fileSystem, spec);
                if (!draftResult.ok) {
                    throw draftResult.error;
                }
                const usedTestPrefixes = (await new FileSystemScenarioSpecRepository(scenariosRoot).listAvailable()).map((scenario) => scenario.testPrefix);
                const workflow = this.compositionRoot.buildSelfCorrectingScenarioWorkflow(jobLogger);
                const workflowResult = await workflow.run({
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
                }, onProgress);
                if (!workflowResult.ok) {
                    throw workflowResult.error;
                }
                const evaluationSummary = buildScenarioEvaluationSummary();
                const generatedProject = {
                    ...workflowResult.value.generatedProject,
                    evaluationSummary,
                };
                await writeGenerationSessionMeta(specPath, workflowResult.value.generatedProject);
                this.updateJob(jobId, {
                    status: 'succeeded',
                    finishedAt: new Date().toISOString(),
                    result: generatedProject,
                    attemptsUsed: workflowResult.value.attemptsUsed,
                });
                return;
            }
            const pipeline = this.compositionRoot.buildGenerationPipeline(jobLogger);
            const result = await pipeline.run(spec, onProgress);
            const evaluationSummary = buildScenarioEvaluationSummary();
            const generatedProject = {
                ...result,
                evaluationSummary,
            };
            await writeGenerationSessionMeta(specPath, result);
            this.updateJob(jobId, {
                status: 'succeeded',
                finishedAt: new Date().toISOString(),
                result: generatedProject,
            });
        }
        catch (error) {
            const evaluationSummary = error instanceof GenerationError && Array.isArray(error.context?.violations)
                ? buildScenarioEvaluationSummary({ violations: error.context.violations })
                : undefined;
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
                steps[fallbackIndex] = { ...steps[fallbackIndex], status: 'failed', finishedAt: now };
            }
            this.updateJob(jobId, {
                status: 'failed',
                finishedAt: now,
                failure,
                evaluationSummary,
                steps: [...steps],
            });
        }
    }
    updateJob(jobId, patch) {
        const existing = this.jobs.get(jobId);
        if (!existing) {
            return;
        }
        this.jobs.set(jobId, { ...existing, ...patch });
    }
}
