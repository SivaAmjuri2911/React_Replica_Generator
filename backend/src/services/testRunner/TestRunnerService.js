/**
 * @typedef {object} TestRunResult
 * @property {boolean} passed
 * @property {number} totalTests
 * @property {number} passedTests
 * @property {string} rawOutput
 */

/**
 * Abstraction over "install dependencies, run the test suite" for a project
 * directory. Deliberately narrow — the pipeline only ever needs these two
 * operations, never arbitrary shell access.
 * @typedef {object} TestRunnerService
 * @property {(projectDir: string) => Promise<import('../../shared/Result.js').Result<void, import('../../domain/errors/GenerationError.js').TestExecutionError>>} installDependencies
 * @property {(projectDir: string) => Promise<import('../../shared/Result.js').Result<TestRunResult, import('../../domain/errors/GenerationError.js').TestExecutionError>>} runTests
 */

export {};
