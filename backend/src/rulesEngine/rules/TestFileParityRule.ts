import path from 'node:path';
import type { GenerationRule, RuleEvaluationContext } from '../GenerationRule.js';
import { err, ok, type Result } from '../../shared/Result.js';
import { RuleViolationError } from '../../domain/errors/GenerationError.js';

const TEST_FILE_EXTENSION_PATTERN = /\.test\.jsx?$/;

/**
 * Enforces: the test file copied into `testcase` is byte-identical to the
 * one already validated (100% passing) inside `solution_code` — the promotion
 * step must be a pure copy, never a re-authored version.
 */
export class TestFileParityRule implements GenerationRule {
  readonly name = 'TestFileParityRule';

  async evaluate(context: RuleEvaluationContext): Promise<Result<void, RuleViolationError>> {
    const { generatedProject, fileSystem } = context;

    const solutionTestFile = await this.findTestFile(fileSystem, generatedProject.solutionCodePath);
    const testcaseTestFile = await this.findTestFile(fileSystem, generatedProject.testcasePath);

    if (!solutionTestFile || !testcaseTestFile) {
      return err(
        new RuleViolationError(
          this.name,
          `Could not locate a *.test.jsx file in both solution_code (${generatedProject.solutionCodePath}) and testcase (${generatedProject.testcasePath})`
        )
      );
    }

    const [solutionContent, testcaseContent] = await Promise.all([
      fileSystem.readFile(solutionTestFile),
      fileSystem.readFile(testcaseTestFile),
    ]);

    if (!solutionContent.ok || !testcaseContent.ok) {
      return err(new RuleViolationError(this.name, 'Could not read one or both test files for comparison'));
    }

    if (solutionContent.value !== testcaseContent.value) {
      return err(
        new RuleViolationError(
          this.name,
          'The test file in testcase must be byte-identical to the validated test file in solution_code'
        )
      );
    }

    return ok(undefined);
  }

  private async findTestFile(
    fileSystem: RuleEvaluationContext['fileSystem'],
    rootDir: string
  ): Promise<string | undefined> {
    const listResult = await fileSystem.listFilesRecursive(rootDir);
    if (!listResult.ok) {
      return undefined;
    }
    return listResult.value.find((filePath) => TEST_FILE_EXTENSION_PATTERN.test(path.basename(filePath)));
  }
}
