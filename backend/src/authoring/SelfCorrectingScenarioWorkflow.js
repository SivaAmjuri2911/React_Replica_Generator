import { err, ok } from '../shared/Result.js';
import { GenerationError, PipelineStepError } from '../domain/errors/GenerationError.js';
import { readBaseSolutionCodeFiles } from './readBaseSolutionCodeFiles.js';
import { ScenarioSpecLoader } from '../config/ScenarioSpecLoader.js';
const DEFAULT_MAX_ATTEMPTS = 3;
const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/g;
const MAX_RAW_OUTPUT_CHARS = 6000;

/**
 * @typedef {import('./ScenarioSpecAuthoringWorkflow.js').ScenarioSpecAuthoringRequest & {
 *   maxAttempts?: number,
 *   initialDraft?: import('../domain/models/ScenarioSpecDraft.js').ScenarioSpecDraft
 * }} SelfCorrectingScenarioRequest
 */

/**
 * @typedef {object} SelfCorrectingScenarioResult
 * @property {import('../domain/models/GeneratedProject.js').GeneratedProject} generatedProject
 * @property {import('../domain/models/ScenarioSpec.js').ScenarioSpec} spec
 * @property {number} attemptsUsed
 */

/**
 * Closes the gap ScenarioSpecAuthoringWorkflow (draft once, hope it's
 * right) and GenerationPipeline (100% deterministic, no LLM) leave between
 * them: a one-shot draft applied to a real project routinely gets one or
 * two small things wrong (a route path, an import name, a label the test
 * expects that the draft never actually produces). Instead of reporting
 * that failure back to a human, this feeds the pipeline's own error —
 * exactly what broke, not a guess — back to the model and asks it to
 * correct just that, materializes the revision, and retries, up to
 * `maxAttempts` times. GenerationPipeline itself stays untouched and still
 * has zero knowledge of any of this — it only ever sees one spec per call
 * and either passes or throws, same as always.
 */
export class SelfCorrectingScenarioWorkflow {
    fileSystem;
    generationService;
    authoringWorkflow;
    generationPipeline;
    specLoader;
    logger;
    constructor(fileSystem, generationService, authoringWorkflow, generationPipeline, logger, specLoader = new ScenarioSpecLoader()) {
        this.fileSystem = fileSystem;
        this.generationService = generationService;
        this.authoringWorkflow = authoringWorkflow;
        this.generationPipeline = generationPipeline;
        this.specLoader = specLoader;
        this.logger = logger.child('SelfCorrectingScenarioWorkflow');
    }
    async run(request, onProgress) {
        const maxAttempts = request.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
        const filesResult = await readBaseSolutionCodeFiles(this.fileSystem, request.baseSolutionCode);
        if (!filesResult.ok) {
            return err(filesResult.error);
        }
        const generationRequest = {
            baseSolutionCodeFiles: filesResult.value,
            usedTestPrefixes: request.usedTestPrefixes,
            ...(request.scenarioDescription ? { scenarioDescription: request.scenarioDescription } : {}),
            ...(request.provider ? { provider: request.provider } : {}),
            ...(request.apiKey ? { apiKey: request.apiKey } : {}),
            ...(request.modelId ? { modelId: request.modelId } : {}),
        };
        let draft;
        if (request.initialDraft) {
            this.logger.info('Starting from a supplied draft', { maxAttempts });
            draft = request.initialDraft;
        }
        else {
            this.logger.info('Requesting initial scenario spec draft', { maxAttempts });
            const initialDraftResult = await this.generationService.generateDraft(generationRequest);
            if (!initialDraftResult.ok) {
                return err(initialDraftResult.error);
            }
            draft = initialDraftResult.value;
        }
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const materializeResult = await this.authoringWorkflow.materializeDraft(draft, request);
            if (!materializeResult.ok) {
                return err(materializeResult.error);
            }
            // materializeDraft() writes (and returns) paths relative to specOutputPath's own
            // directory, so spec.json stays portable on disk — but GenerationPipeline needs real
            // filesystem paths, not strings relative to a directory it never resolves against.
            // Reload from the file just written, exactly like the one-shot `generate` flow does,
            // instead of using materializeDraft's in-memory (relative-path) spec directly.
            let spec;
            try {
                spec = await this.specLoader.loadFromFile(request.specOutputPath);
            }
            catch (cause) {
                return err(cause instanceof GenerationError ? cause : new PipelineStepError('SelfCorrectingScenarioWorkflow', cause));
            }
            // Start each attempt from a clean output dir — otherwise a file a previous (different)
            // draft renamed could linger even though the current draft doesn't rename it, silently
            // corrupting this attempt with stale state from the last one.
            const cleanResult = await this.fileSystem.removeDirectory(request.outputRoot);
            if (!cleanResult.ok) {
                return err(cleanResult.error);
            }
            this.logger.info(`Running generation attempt ${attempt}/${maxAttempts}`, { scenarioName: spec.scenarioName });
            try {
                const generatedProject = await this.generationPipeline.run(spec, onProgress);
                this.logger.info('Generation succeeded', { attempt });
                return ok({ generatedProject, spec, attemptsUsed: attempt });
            }
            catch (cause) {
                const error = cause instanceof GenerationError ? cause : new PipelineStepError('GenerationPipeline', cause);
                lastError = error;
                // Computed once and reused below — this is the same summary (with raw npm/vitest
                // output, truncated + ANSI-stripped) that gets sent to the model for revision, so the
                // server log carries exactly what the model saw instead of just a bare error code.
                const failureSummary = this.summarizeFailureForRevision(error);
                if (attempt === maxAttempts) {
                    this.logger.warn('Exhausted all attempts without a passing generation', {
                        attempts: maxAttempts,
                        lastFailure: failureSummary,
                    });
                    break;
                }
                this.logger.warn(`Attempt ${attempt} failed — asking the model to revise its draft`, {
                    code: error.code,
                    failureSummary,
                });
                const revisionResult = await this.generationService.reviseDraft(generationRequest, draft, failureSummary);
                if (!revisionResult.ok) {
                    return err(revisionResult.error);
                }
                draft = revisionResult.value;
            }
        }
        return err(lastError ?? new PipelineStepError('SelfCorrectingScenarioWorkflow', new Error('No attempts were made')));
    }
    /** Turns a pipeline failure into exactly what the model needs to fix it — the real error, not a guess at one. */
    summarizeFailureForRevision(error) {
        const parts = [`[${error.code}] ${error.message}`];
        const rawOutput = error.context.rawOutput;
        if (typeof rawOutput === 'string') {
            const stripped = rawOutput.replace(ANSI_ESCAPE_PATTERN, '');
            const truncated = stripped.length > MAX_RAW_OUTPUT_CHARS
                ? `${stripped.slice(0, MAX_RAW_OUTPUT_CHARS)}\n...[truncated, ${stripped.length - MAX_RAW_OUTPUT_CHARS} more characters]`
                : stripped;
            parts.push(`Raw test output:\n${truncated}`);
        }
        else {
            const otherContext = Object.entries(error.context).filter(([key]) => key !== 'rawOutput');
            if (otherContext.length > 0) {
                parts.push(`Details: ${JSON.stringify(Object.fromEntries(otherContext))}`);
            }
        }
        return parts.join('\n\n');
    }
}
