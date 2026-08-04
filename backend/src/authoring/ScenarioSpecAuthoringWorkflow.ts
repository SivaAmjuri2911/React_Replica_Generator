import path from 'node:path';
import type { FileSystemService } from '../services/fileSystem/FileSystemService.js';
import type { ScenarioSpecGenerationService } from '../services/scenarioSpecGeneration/ScenarioSpecGenerationService.js';
import type { Logger } from '../logging/Logger.js';
import { err, ok, type Result } from '../shared/Result.js';
import type { GenerationError } from '../domain/errors/GenerationError.js';
import type { PlatformMetadata, ScenarioSpec } from '../domain/models/ScenarioSpec.js';
import type { ScenarioSpecDraft } from '../domain/models/ScenarioSpecDraft.js';
import type { LlmProvider } from '../domain/models/LlmProvider.js';
import type { AnalysisPhaseListener } from '../domain/models/AnalysisJob.js';
import { readBaseSolutionCodeFiles } from './readBaseSolutionCodeFiles.js';

export interface ScenarioSpecAuthoringRequest {
  /** Omit to let the model invent an appropriate new scenario itself — see scenarioSpecDraftContract.ts. */
  readonly scenarioDescription?: string;
  readonly platformMetadata: PlatformMetadata;
  readonly usedTestPrefixes: readonly string[];
  readonly basePrefilledCode: string;
  readonly baseSolutionCode: string;
  readonly baseTestcase: string;
  readonly ideBasedCodingOutputDir: string;
  readonly outputRoot: string;
  readonly stagingDir: string;
  /** Where the finished spec.json gets written. */
  readonly specOutputPath: string;
  /** Which vendor to draft with. Defaults to 'anthropic' when omitted. */
  readonly provider?: LlmProvider;
  /** Caller-supplied API key for the chosen provider, forwarded to ScenarioSpecGenerationService. */
  readonly apiKey?: string;
  /** Which model to draft with. */
  readonly modelId?: string;
}

/**
 * Orchestrates the one LLM-backed step in this system: reads an arbitrary
 * base solution_code's source files, asks ScenarioSpecGenerationService to
 * draft a transformation, stages the draft's manually-authored file content
 * to disk, and writes a complete ScenarioSpec JSON that GenerationPipeline
 * (100% deterministic, no LLM involved) can then consume unmodified via the
 * existing `generate` command.
 *
 * `run()` and `materializeDraft()` are deliberately split so
 * SelfCorrectingScenarioWorkflow can reuse the "stage files + write
 * spec.json" half against a *revised* draft without re-implementing it.
 */
export class ScenarioSpecAuthoringWorkflow {
  private readonly fileSystem: FileSystemService;
  private readonly generationService: ScenarioSpecGenerationService;
  private readonly logger: Logger;

  constructor(fileSystem: FileSystemService, generationService: ScenarioSpecGenerationService, logger: Logger) {
    this.fileSystem = fileSystem;
    this.generationService = generationService;
    this.logger = logger.child('ScenarioSpecAuthoringWorkflow');
  }

  async run(
    request: ScenarioSpecAuthoringRequest,
    onPhase?: AnalysisPhaseListener
  ): Promise<Result<ScenarioSpec, GenerationError>> {
    onPhase?.({ type: 'phase-start', phase: 'reading-solution-code' });
    const filesResult = await readBaseSolutionCodeFiles(this.fileSystem, request.baseSolutionCode);
    if (!filesResult.ok) {
      onPhase?.({ type: 'phase-failed', phase: 'reading-solution-code', error: filesResult.error });
      return err(filesResult.error);
    }
    onPhase?.({ type: 'phase-complete', phase: 'reading-solution-code' });

    this.logger.info('Read base solution_code source files', { count: filesResult.value.length });

    onPhase?.({ type: 'phase-start', phase: 'drafting-with-model' });
    const draftResult = await this.generationService.generateDraft({
      baseSolutionCodeFiles: filesResult.value,
      usedTestPrefixes: request.usedTestPrefixes,
      ...(request.scenarioDescription ? { scenarioDescription: request.scenarioDescription } : {}),
      ...(request.provider ? { provider: request.provider } : {}),
      ...(request.apiKey ? { apiKey: request.apiKey } : {}),
      ...(request.modelId ? { modelId: request.modelId } : {}),
    });
    if (!draftResult.ok) {
      onPhase?.({ type: 'phase-failed', phase: 'drafting-with-model', error: draftResult.error });
      return err(draftResult.error);
    }
    onPhase?.({ type: 'phase-complete', phase: 'drafting-with-model' });

    return this.materializeDraft(draftResult.value, request, onPhase);
  }

  /** Stages a draft's manually-authored files and writes the resulting spec.json — the part of `run()` that has nothing to do with generating the draft itself. */
  async materializeDraft(
    draft: ScenarioSpecDraft,
    request: ScenarioSpecAuthoringRequest,
    onPhase?: AnalysisPhaseListener
  ): Promise<Result<ScenarioSpec, GenerationError>> {
    onPhase?.({ type: 'phase-start', phase: 'saving-spec' });
    for (const file of draft.manuallyAuthoredFiles) {
      const writeResult = await this.fileSystem.writeFile(
        path.join(request.stagingDir, file.relativePath),
        stripLeadingFileHeader(file.content)
      );
      if (!writeResult.ok) {
        onPhase?.({ type: 'phase-failed', phase: 'saving-spec', error: writeResult.error });
        return err(writeResult.error);
      }
    }

    // Store paths relative to the spec file's own directory (mirrors ScenarioSpecLoader's
    // inverse resolve-on-load) so the written spec.json stays portable/checkable-in, matching
    // every hand-authored spec.json's convention.
    const specDir = path.dirname(request.specOutputPath);
    const relativize = (absolutePath: string): string =>
      path.relative(specDir, absolutePath).split(path.sep).join('/');

    const spec: ScenarioSpec = {
      scenarioName: draft.scenarioName,
      outputFolderBaseName: draft.outputFolderBaseName,
      testPrefix: draft.testPrefix,
      platformMetadata: request.platformMetadata,
      paths: {
        basePrefilledCode: relativize(request.basePrefilledCode),
        baseSolutionCode: relativize(request.baseSolutionCode),
        baseTestcase: relativize(request.baseTestcase),
        ideBasedCodingOutputDir: relativize(request.ideBasedCodingOutputDir),
        outputRoot: relativize(request.outputRoot),
        stagingDir: relativize(request.stagingDir),
      },
      textReplacements: draft.textReplacements,
      fileRenames: draft.fileRenames,
      transformableRelativePaths: draft.transformableRelativePaths,
      colorSwaps: draft.colorSwaps,
      manuallyAuthoredRelativePaths: draft.manuallyAuthoredFiles.map((file) => file.relativePath),
    };

    const writeSpecResult = await this.fileSystem.writeFile(
      request.specOutputPath,
      `${JSON.stringify(spec, null, 2)}\n`
    );
    if (!writeSpecResult.ok) {
      onPhase?.({ type: 'phase-failed', phase: 'saving-spec', error: writeSpecResult.error });
      return err(writeSpecResult.error);
    }

    this.logger.info('Wrote scenario spec draft', {
      specOutputPath: request.specOutputPath,
      scenarioName: spec.scenarioName,
    });
    onPhase?.({ type: 'phase-complete', phase: 'saving-spec' });

    return ok(spec);
  }
}

/**
 * The prompt shows the model each base file prefixed with a "--- FILE: path ---" line so it can
 * tell where one file ends and the next begins (see buildScenarioSpecDraftUserPrompt) — that line
 * is never real file content. Models occasionally echo it back as the first line of a
 * manually-authored file's own "content", which is a syntax error in any real source file. Since
 * that exact header can never legitimately be real code, stripping it is a safe backstop
 * regardless of how well the prompt (see scenarioSpecDraftContract.ts rule 13) prevents it.
 */
const LEADING_FILE_HEADER_PATTERN = /^--- FILE: .+ ---\r?\n/;

function stripLeadingFileHeader(content: string): string {
  return content.replace(LEADING_FILE_HEADER_PATTERN, '');
}
