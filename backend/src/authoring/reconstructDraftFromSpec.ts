import path from 'node:path';
import type { FileSystemService } from '../services/fileSystem/FileSystemService.js';
import type { ScenarioSpec } from '../domain/models/ScenarioSpec.js';
import type { ManuallyAuthoredFileDraft, ScenarioSpecDraft } from '../domain/models/ScenarioSpecDraft.js';
import { err, ok, type Result } from '../shared/Result.js';
import type { GenerationError } from '../domain/errors/GenerationError.js';

/**
 * Rebuilds the ScenarioSpecDraft a materialized ScenarioSpec was written
 * from, so a previously-drafted-and-reviewed spec can re-enter
 * SelfCorrectingScenarioWorkflow's retry loop (which needs the draft shape
 * to call `reviseDraft`) without re-drafting from scratch. Safe because
 * ScenarioSpecAuthoringWorkflow.materializeDraft() staged each
 * manually-authored file's exact content into `spec.paths.stagingDir` —
 * reading it back is lossless, unlike trying to derive it from the
 * downstream solution_code output (which has since been text-transformed).
 */
export async function reconstructDraftFromSpec(
  fileSystem: FileSystemService,
  spec: ScenarioSpec
): Promise<Result<ScenarioSpecDraft, GenerationError>> {
  const manuallyAuthoredFiles: ManuallyAuthoredFileDraft[] = [];

  for (const relativePath of spec.manuallyAuthoredRelativePaths) {
    const readResult = await fileSystem.readFile(path.join(spec.paths.stagingDir, relativePath));
    if (!readResult.ok) {
      return err(readResult.error);
    }
    manuallyAuthoredFiles.push({ relativePath, content: readResult.value });
  }

  return ok({
    scenarioName: spec.scenarioName,
    outputFolderBaseName: spec.outputFolderBaseName,
    testPrefix: spec.testPrefix,
    textReplacements: spec.textReplacements,
    fileRenames: spec.fileRenames,
    colorSwaps: spec.colorSwaps,
    transformableRelativePaths: spec.transformableRelativePaths,
    manuallyAuthoredFiles,
  });
}
