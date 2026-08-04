import path from 'node:path';
import type { PipelineStep } from '../PipelineStep.js';
import type { PipelineContext } from '../PipelineContext.js';
import type { FileSystemService } from '../../services/fileSystem/FileSystemService.js';
import { outputPrefilledCodePath, packageName } from '../../domain/models/ScenarioSpec.js';
import { setPackageJsonName } from './packageJsonUtils.js';
import { FileSystemError } from '../../domain/errors/GenerationError.js';
import type { Logger } from '../../logging/Logger.js';

/**
 * prefilled_code stays a byte-for-byte copy of the base starter — only the
 * package.json/package-lock.json "name" field changes (GENERATION_RULES.md:
 * "By default stays a blank starter ... Only if the new scenario specifically
 * requires it may App.jsx/App.css be updated" — content edits, if any, are
 * expected to already be reflected in the base path the spec points at).
 */
export class ScaffoldPrefilledCodeStep implements PipelineStep {
  readonly name = 'ScaffoldPrefilledCodeStep';
  private readonly fileSystem: FileSystemService;
  private readonly logger: Logger;

  constructor(fileSystem: FileSystemService, logger: Logger) {
    this.fileSystem = fileSystem;
    this.logger = logger;
  }

  async execute(context: PipelineContext): Promise<void> {
    const destination = outputPrefilledCodePath(context.spec);

    // The actual copy below is one bulk fs.cp() call with nothing to instrument mid-flight —
    // list the files first purely so "currently processing: X" has something real to show
    // while the (typically fast) starter-code copy runs.
    const manifestResult = await this.fileSystem.listFilesRecursive(context.spec.paths.basePrefilledCode);
    if (manifestResult.ok) {
      for (const absoluteFilePath of manifestResult.value) {
        const relativePath = path.relative(context.spec.paths.basePrefilledCode, absoluteFilePath).split(path.sep).join('/');
        this.logger.debug(`Processing file: ${relativePath}`);
      }
    }

    const copyResult = await this.fileSystem.copyDirectory(context.spec.paths.basePrefilledCode, destination);
    if (!copyResult.ok) {
      throw copyResult.error;
    }

    const expectedName = packageName(context.spec);
    await this.renamePackageIfPresent(path.join(destination, 'package.json'), expectedName);
    await this.renamePackageIfPresent(path.join(destination, 'package-lock.json'), expectedName);

    context.prefilledCodePath = destination;
  }

  private async renamePackageIfPresent(filePath: string, expectedName: string): Promise<void> {
    if (!(await this.fileSystem.exists(filePath))) {
      return;
    }
    const result = await setPackageJsonName(this.fileSystem, filePath, expectedName);
    if (!result.ok) {
      throw new FileSystemError(`Failed to set package name in "${filePath}"`, { cause: result.error });
    }
  }
}
