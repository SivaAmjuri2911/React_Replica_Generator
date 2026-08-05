import path from 'node:path';
import type { PipelineStep } from '../PipelineStep.js';
import type { PipelineContext } from '../PipelineContext.js';
import type { FileSystemService } from '../../services/fileSystem/FileSystemService.js';
import type { TextTransformationService } from '../../services/textTransformation/TextTransformationService.js';
import { outputSolutionCodePath, packageName } from '../../domain/models/ScenarioSpec.js';
import { setPackageJsonName } from './packageJsonUtils.js';
import { findReadmeFile } from './findReadmeFile.js';
import { FileSystemError } from '../../domain/errors/GenerationError.js';
import type { Logger } from '../../logging/Logger.js';

/**
 * solution_code is built by: copying the base, applying declared file
 * renames, running text/color replacements only on the explicitly declared
 * transformable files (everything else stays byte-for-byte boilerplate),
 * then overlaying any manually-authored files from staging.
 */
export class TransformSolutionCodeStep implements PipelineStep {
  readonly name = 'TransformSolutionCodeStep';
  private readonly fileSystem: FileSystemService;
  private readonly textTransformation: TextTransformationService;
  private readonly logger: Logger;

  constructor(fileSystem: FileSystemService, textTransformation: TextTransformationService, logger: Logger) {
    this.fileSystem = fileSystem;
    this.textTransformation = textTransformation;
    this.logger = logger;
  }

  async execute(context: PipelineContext): Promise<void> {
    const { spec } = context;
    const destination = outputSolutionCodePath(spec);

    const copyResult = await this.fileSystem.copyDirectory(spec.paths.baseSolutionCode, destination);
    if (!copyResult.ok) {
      throw copyResult.error;
    }

    for (const rename of spec.fileRenames) {
      const moveResult = await this.fileSystem.moveFile(
        path.join(destination, rename.fromRelativePath),
        path.join(destination, rename.toRelativePath)
      );
      if (!moveResult.ok) {
        throw moveResult.error;
      }
    }

    const colorReplacements = spec.colorSwaps.map((swap) => ({ from: swap.fromHex, to: swap.toHex }));

    for (const relativePath of spec.transformableRelativePaths) {
      this.logger.debug(`Processing file: ${relativePath}`);
      const filePath = path.join(destination, relativePath);
      if (!(await this.fileSystem.exists(filePath))) {
        throw new FileSystemError(`Declared transformable path does not exist after copy: "${relativePath}"`, {
          filePath,
        });
      }
      const contentResult = await this.fileSystem.readFile(filePath);
      if (!contentResult.ok) {
        throw contentResult.error;
      }
      // Entity/text renames chain intentionally (a longer match's output can feed a
      // shorter, later replacement — see TextReplacement's doc comment). Colors must NOT
      // chain: a real palette often has one swap's target hex equal to another swap's
      // source hex, and chaining would silently carry a value past its own intended
      // target into whatever the next matching entry produces. So colors are applied as
      // a second, simultaneous pass over the already-renamed text instead of being folded
      // into the same ordered list.
      const renamed = this.textTransformation.applyReplacements(contentResult.value, spec.textReplacements);
      const transformed = this.textTransformation.applySimultaneousReplacements(renamed, colorReplacements);
      const writeResult = await this.fileSystem.writeFile(filePath, transformed);
      if (!writeResult.ok) {
        throw writeResult.error;
      }
    }

    for (const relativePath of spec.manuallyAuthoredRelativePaths) {
      this.logger.debug(`Processing file: ${relativePath}`);
      const sourcePath = path.join(spec.paths.stagingDir, relativePath);
      const destinationPath = path.join(destination, relativePath);
      if (!(await this.fileSystem.exists(sourcePath))) {
        throw new FileSystemError(`Manually-authored file missing from staging: "${relativePath}"`, {
          sourcePath,
        });
      }
      const contentResult = await this.fileSystem.readFile(sourcePath);
      if (!contentResult.ok) {
        throw contentResult.error;
      }
      const writeResult = await this.fileSystem.writeFile(destinationPath, contentResult.value);
      if (!writeResult.ok) {
        throw writeResult.error;
      }
    }

    const expectedName = packageName(spec);
    await this.renamePackageIfPresent(path.join(destination, 'package.json'), expectedName);
    await this.renamePackageIfPresent(path.join(destination, 'package-lock.json'), expectedName);

    // BuildIdeBasedCodingJsonStep needs the readme's content for question_text, but doesn't run
    // until after ValidateJavaScriptSyntaxStep/ValidateImportResolutionStep/ValidateSolutionTestsStep
    // (a real npm install + test cycle, tens of seconds at minimum). Checking here instead means a
    // draft whose fileRenames/manuallyAuthoredRelativePaths drop the readme away fails in
    // milliseconds, right where the mistake was made, instead of burning an entire self-correction
    // attempt's worth of install+test time only to fail on something the tests never touched.
    if (!(await findReadmeFile(this.fileSystem, destination))) {
      throw new FileSystemError(
        `solution_code has no readme file (README.md / readme.md, any casing) at its root after ` +
          `transformation — it must survive the transformation (via a byte-for-byte copy, a ` +
          `transformable path, or a manually-authored file), since BuildIdeBasedCodingJsonStep uses ` +
          `its content as the platform's question_text.`,
        { destination }
      );
    }

    context.solutionCodePath = destination;
  }

  private async renamePackageIfPresent(filePath: string, expectedName: string): Promise<void> {
    if (!(await this.fileSystem.exists(filePath))) {
      return;
    }
    const result = await setPackageJsonName(this.fileSystem, filePath, expectedName);
    if (!result.ok) {
      throw result.error;
    }
  }
}
