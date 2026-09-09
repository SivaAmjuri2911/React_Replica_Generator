import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { FileSystemScenarioSpecRepository } from '../../config/FileSystemScenarioSpecRepository.js';
import { CapturingLogger } from '../../logging/CapturingLogger.js';
import { GenerationError } from '../../domain/errors/GenerationError.js';
import { AdmZipArchiveExtractionService } from '../../services/archive/AdmZipArchiveExtractionService.js';
import { ANALYSIS_PHASE_LABELS } from '../../config/progressLabels.js';
/**
 * Runs analyses in the background inside the same Node process — same
 * single-operator scope tradeoff as InMemoryGenerationJobService, see its
 * doc comment.
 */
/**
 * @implements {AnalysisJobService}
 */
export class InMemoryAnalysisJobService {
    jobs = new Map();
    compositionRoot;
    scenariosRoot;
    /**
     * The testcase folder (pnpm/ccbp-jest-reporter setup) is structurally
     * identical across every scenario — GENERATION_RULES.md never lets its
     * content change except package.json's name field and the promoted test
     * file, both applied downstream by GenerationPipeline. So it's a fixed
     * server-side template, not something re-uploaded per run; only used
     * directly (read-only — never mutated in place, see
     * TestcaseFolderImmutabilityRule) when a request omits testcaseZipPath.
     */
    defaultBaseTestcase;
    archiveExtraction;
    constructor(compositionRoot, scenariosRoot, defaultBaseTestcase, archiveExtraction = new AdmZipArchiveExtractionService()) {
        this.compositionRoot = compositionRoot;
        this.scenariosRoot = scenariosRoot;
        this.defaultBaseTestcase = defaultBaseTestcase;
        this.archiveExtraction = archiveExtraction;
    }
    async startJob(request) {
        const jobId = randomUUID();
        // No slug means the operator is letting the model invent the scenario too — there's
        // nothing meaningful to name the folder after yet, so it's keyed to the job itself.
        const scenarioSlug = request.scenarioSlug ?? `analysis-${jobId.slice(0, 8)}`;
        const logs = [];
        const job = {
            id: jobId,
            scenarioSlug,
            status: 'pending',
            startedAt: new Date().toISOString(),
            logs,
            phases: ANALYSIS_PHASE_LABELS.map((phase) => ({ name: phase.name, label: phase.label, status: 'pending' })),
        };
        this.jobs.set(jobId, job);
        void this.runJob(jobId, scenarioSlug, request, logs);
        return jobId;
    }
    getJob(jobId) {
        return this.jobs.get(jobId);
    }
    listJobs() {
        return [...this.jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    }
    cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return false;
        }
        if (job.status !== 'pending' && job.status !== 'running') {
            return false;
        }
        const now = new Date().toISOString();
        const phases = job.phases.map((phase) => phase.status === 'running'
            ? { ...phase, status: 'failed', finishedAt: now }
            : phase);
        this.jobs.set(jobId, {
            ...job,
            status: 'failed',
            finishedAt: now,
            cancelled: true,
            failure: {
                code: 'CANCELLED',
                message: 'Design was cancelled',
                context: {},
            },
            phases,
        });
        return true;
    }
    async deleteJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return false;
        }
        if (job.status === 'pending' || job.status === 'running') {
            throw new Error('Cannot delete a project while it is still running');
        }
        this.jobs.delete(jobId);
        const scenarioDir = path.join(this.scenariosRoot, job.scenarioSlug);
        const removeResult = await this.compositionRoot.fileSystem.removeDirectory(scenarioDir);
        if (!removeResult.ok) {
            throw removeResult.error;
        }
        return true;
    }
    async runJob(jobId, scenarioSlug, request, logs) {
        this.updateJob(jobId, { status: 'running' });
        const jobLogger = new CapturingLogger(this.compositionRoot.logger, (line) => logs.push(line), 'analyze');
        const fileSystem = this.compositionRoot.fileSystem;
        const phases = ANALYSIS_PHASE_LABELS.map((phase) => ({
            name: phase.name,
            label: phase.label,
            status: 'pending',
        }));
        const onPhase = (event) => {
            const index = phases.findIndex((phase) => phase.name === event.phase);
            if (index < 0) {
                return;
            }
            const now = new Date().toISOString();
            if (event.type === 'phase-start') {
                // exactOptionalPropertyTypes forbids `finishedAt: undefined` — build a fresh object
                // that omits the key entirely instead of spreading and nulling it out.
                const { name, label } = phases[index];
                phases[index] = { name, label, status: 'running', startedAt: now };
            }
            else if (event.type === 'phase-complete') {
                phases[index] = { ...phases[index], status: 'succeeded', finishedAt: now };
            }
            else {
                phases[index] = { ...phases[index], status: 'failed', finishedAt: now };
            }
            this.updateJob(jobId, { phases: [...phases] });
        };
        try {
            const scenarioDir = path.join(this.scenariosRoot, scenarioSlug);
            const uploadedDir = path.join(scenarioDir, 'uploaded');
            const basePrefilledCode = path.join(uploadedDir, 'prefilled_code');
            const baseSolutionCode = path.join(uploadedDir, 'solution_code');
            onPhase({ type: 'phase-start', phase: 'extracting-uploads' });
            jobLogger.info('Extracting uploaded archives');
            await this.extractOrThrow(request.prefilledCodeZipPath, basePrefilledCode);
            await this.extractOrThrow(request.solutionCodeZipPath, baseSolutionCode);
            const uploadedZipPaths = [request.prefilledCodeZipPath, request.solutionCodeZipPath];
            let baseTestcase;
            if (request.testcaseZipPath) {
                baseTestcase = path.join(uploadedDir, 'testcase');
                await this.extractOrThrow(request.testcaseZipPath, baseTestcase);
                uploadedZipPaths.push(request.testcaseZipPath);
            }
            else {
                baseTestcase = this.defaultBaseTestcase;
                jobLogger.info('No testcase upload provided — using the server\'s default testcase folder', {
                    baseTestcase,
                });
            }
            for (const zipPath of uploadedZipPaths) {
                await fileSystem.removeFile(zipPath);
            }
            onPhase({ type: 'phase-complete', phase: 'extracting-uploads' });
            const specRepository = new FileSystemScenarioSpecRepository(this.scenariosRoot);
            const usedTestPrefixes = (await specRepository.listAvailable()).map((scenario) => scenario.testPrefix);
            const workflow = this.compositionRoot.buildScenarioSpecAuthoringWorkflow(jobLogger);
            const specPath = path.join(scenarioDir, 'spec.json');
            const result = await workflow.run({
                ...(request.scenarioDescription ? { scenarioDescription: request.scenarioDescription } : {}),
                platformMetadata: request.platformMetadata,
                usedTestPrefixes,
                basePrefilledCode,
                baseSolutionCode,
                baseTestcase,
                ideBasedCodingOutputDir: path.join(scenarioDir, 'output', 'IDE_BASED_CODING'),
                outputRoot: path.join(scenarioDir, 'output'),
                stagingDir: path.join(scenarioDir, 'staging'),
                specOutputPath: specPath,
                ...(request.provider ? { provider: request.provider } : {}),
                apiKey: request.apiKey,
                ...(request.modelId ? { modelId: request.modelId } : {}),
            }, onPhase);
            if (!result.ok) {
                throw result.error;
            }
            this.updateJob(jobId, {
                status: 'succeeded',
                finishedAt: new Date().toISOString(),
                result: result.value,
                specPath,
            });
        }
        catch (error) {
            const failure = error instanceof GenerationError
                ? { code: error.code, message: error.message, context: error.context }
                : { code: 'UNEXPECTED_ERROR', message: String(error), context: {} };
            // Whatever phase was running (or, if the error struck before any phase
            // even started, the first pending one) never got its own phase-failed
            // event — mark it explicitly so the UI's step tracker doesn't show a
            // spinner spinning forever on a job that has already stopped.
            const now = new Date().toISOString();
            const stalledIndex = phases.findIndex((phase) => phase.status === 'running');
            const fallbackIndex = stalledIndex >= 0 ? stalledIndex : phases.findIndex((phase) => phase.status === 'pending');
            if (fallbackIndex >= 0) {
                phases[fallbackIndex] = { ...phases[fallbackIndex], status: 'failed', finishedAt: now };
            }
            this.updateJob(jobId, {
                status: 'failed',
                finishedAt: now,
                failure,
                phases: [...phases],
            });
        }
    }
    async extractOrThrow(zipFilePath, destinationDir) {
        const result = await this.archiveExtraction.extractZip(zipFilePath, destinationDir);
        if (!result.ok) {
            throw result.error;
        }
    }
    updateJob(jobId, patch) {
        const existing = this.jobs.get(jobId);
        if (!existing || existing.cancelled) {
            return;
        }
        this.jobs.set(jobId, { ...existing, ...patch });
    }
}
