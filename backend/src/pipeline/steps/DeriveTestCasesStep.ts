import path from 'node:path';
import type { PipelineStep } from '../PipelineStep.js';
import type { PipelineContext } from '../PipelineContext.js';
import type { FileSystemService } from '../../services/fileSystem/FileSystemService.js';
import type { TestCaseDerivationService } from '../../services/testCaseDerivation/TestCaseDerivationService.js';
import { FileSystemError } from '../../domain/errors/GenerationError.js';

const TEST_FILE_EXTENSION_PATTERN = /\.test\.jsx?$/;

/**
 * Derives the IDE_BASED_CODING test_cases[] directly from the promoted
 * testcase test file's markers — never hand-authored (see
 * scripts/build-test-cases-json.js, which this service is the typed,
 * tested successor to).
 */
export class DeriveTestCasesStep implements PipelineStep {
  readonly name = 'DeriveTestCasesStep';
  private readonly fileSystem: FileSystemService;
  private readonly derivationService: TestCaseDerivationService;

  constructor(fileSystem: FileSystemService, derivationService: TestCaseDerivationService) {
    this.fileSystem = fileSystem;
    this.derivationService = derivationService;
  }

  async execute(context: PipelineContext): Promise<void> {
    if (!context.testcasePath) {
      throw new FileSystemError('testcasePath is not set — PromoteTestsToTestcaseStep must run first');
    }

    const listResult = await this.fileSystem.listFilesRecursive(context.testcasePath);
    if (!listResult.ok) {
      throw listResult.error;
    }
    const testFilePath = listResult.value.find((filePath) => TEST_FILE_EXTENSION_PATTERN.test(path.basename(filePath)));
    if (!testFilePath) {
      throw new FileSystemError(`No *.test.jsx file found under "${context.testcasePath}"`);
    }

    const contentResult = await this.fileSystem.readFile(testFilePath);
    if (!contentResult.ok) {
      throw contentResult.error;
    }

    const derivedResult = this.derivationService.deriveFromTestFileContents(
      contentResult.value,
      context.spec.testPrefix
    );
    if (!derivedResult.ok) {
      throw derivedResult.error;
    }

    context.testCases = derivedResult.value;
  }
}
