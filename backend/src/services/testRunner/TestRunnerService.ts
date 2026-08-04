import type { Result } from '../../shared/Result.js';
import type { TestExecutionError } from '../../domain/errors/GenerationError.js';

export interface TestRunResult {
  readonly passed: boolean;
  readonly totalTests: number;
  readonly passedTests: number;
  readonly rawOutput: string;
}

/**
 * Abstraction over "install dependencies, run the test suite" for a project
 * directory. Deliberately narrow — the pipeline only ever needs these two
 * operations, never arbitrary shell access.
 */
export interface TestRunnerService {
  installDependencies(projectDir: string): Promise<Result<void, TestExecutionError>>;
  runTests(projectDir: string): Promise<Result<TestRunResult, TestExecutionError>>;
}
