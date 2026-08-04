import path from 'node:path';
import type { PipelineStep } from '../PipelineStep.js';
import type { PipelineContext } from '../PipelineContext.js';
import type { FileSystemService } from '../../services/fileSystem/FileSystemService.js';
import { outputTestcasePath, packageName } from '../../domain/models/ScenarioSpec.js';
import { setPackageJsonName } from './packageJsonUtils.js';
import { FileSystemError } from '../../domain/errors/GenerationError.js';

const TEST_FILE_EXTENSION_PATTERN = /\.test\.jsx?$/;

/**
 * The strictest step in the pipeline: testcase is copied from the base
 * UNTOUCHED (its pnpm/ccbp-jest-reporter setup, its own react-router-dom
 * version — everything stays exactly as the base declares it), then only
 * two things change: package.json's "name" field, and the test file itself
 * gets overwritten with the byte-identical, already-validated copy from
 * solution_code. Nothing here is authored — see TestcaseFolderImmutabilityRule
 * and TestFileParityRule, which verify this step did its job correctly.
 */
export class PromoteTestsToTestcaseStep implements PipelineStep {
  readonly name = 'PromoteTestsToTestcaseStep';
  private readonly fileSystem: FileSystemService;

  constructor(fileSystem: FileSystemService) {
    this.fileSystem = fileSystem;
  }

  async execute(context: PipelineContext): Promise<void> {
    if (!context.validatedTestFilePath) {
      throw new FileSystemError('validatedTestFilePath is not set — ValidateSolutionTestsStep must run first');
    }

    const destination = outputTestcasePath(context.spec);

    const copyResult = await this.fileSystem.copyDirectory(context.spec.paths.baseTestcase, destination);
    if (!copyResult.ok) {
      throw copyResult.error;
    }

    const expectedName = packageName(context.spec);
    const packageJsonPath = path.join(destination, 'package.json');
    if (await this.fileSystem.exists(packageJsonPath)) {
      const renameResult = await setPackageJsonName(this.fileSystem, packageJsonPath, expectedName);
      if (!renameResult.ok) {
        throw renameResult.error;
      }
    }

    const existingTestFilePath = await this.findTestFile(destination);
    if (!existingTestFilePath) {
      throw new FileSystemError(`No *.test.jsx file found in base testcase folder under "${destination}"`);
    }

    const validatedContentResult = await this.fileSystem.readFile(context.validatedTestFilePath);
    if (!validatedContentResult.ok) {
      throw validatedContentResult.error;
    }

    // The base testcase folder is a fixed server-side template, so its test file
    // still carries the template scenario's name (e.g. "Bid.test.jsx"). The promoted
    // file must land under solution_code's own name (e.g. "Main.test.jsx") so the
    // testcase folder mirrors the uploaded structure — same directory, same basename.
    const promotedTestFilePath = path.join(
      path.dirname(existingTestFilePath),
      path.basename(context.validatedTestFilePath)
    );
    if (promotedTestFilePath !== existingTestFilePath) {
      const removeResult = await this.fileSystem.removeFile(existingTestFilePath);
      if (!removeResult.ok) {
        throw removeResult.error;
      }
    }

    const writeResult = await this.fileSystem.writeFile(promotedTestFilePath, validatedContentResult.value);
    if (!writeResult.ok) {
      throw writeResult.error;
    }

    context.testcasePath = destination;
  }

  private async findTestFile(testcasePath: string): Promise<string | undefined> {
    const listResult = await this.fileSystem.listFilesRecursive(testcasePath);
    if (!listResult.ok) {
      return undefined;
    }
    return listResult.value.find((filePath) => TEST_FILE_EXTENSION_PATTERN.test(path.basename(filePath)));
  }
}
