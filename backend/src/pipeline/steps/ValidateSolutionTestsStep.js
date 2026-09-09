import path from 'node:path';
import { TestExecutionError } from '../../domain/errors/GenerationError.js';
const TEST_FILE_EXTENSION_PATTERN = /\.test\.jsx?$/;
/**
 * The gate GENERATION_RULES.md calls "Test file workflow (order matters)":
 * the new test file is validated inside solution_code BEFORE anything is
 * promoted to testcase. A generation run stops here, hard, on any failure —
 * there is no such thing as a "partially passing" generated scenario.
 */
/**
 * @implements {PipelineStep}
 */
export class ValidateSolutionTestsStep {
    name = 'ValidateSolutionTestsStep';
    fileSystem;
    testRunner;
    constructor(fileSystem, testRunner) {
        this.fileSystem = fileSystem;
        this.testRunner = testRunner;
    }
    async execute(context) {
        if (!context.solutionCodePath) {
            throw new TestExecutionError('solutionCodePath is not set — TransformSolutionCodeStep must run first');
        }
        const installResult = await this.testRunner.installDependencies(context.solutionCodePath);
        if (!installResult.ok) {
            throw installResult.error;
        }
        const testResult = await this.testRunner.runTests(context.solutionCodePath);
        if (!testResult.ok) {
            throw testResult.error;
        }
        if (!testResult.value.passed) {
            throw new TestExecutionError(`Generated solution failed its own tests: ${testResult.value.passedTests}/${testResult.value.totalTests} passed`, { rawOutput: testResult.value.rawOutput });
        }
        const testFilePath = await this.findTestFile(context.solutionCodePath);
        if (!testFilePath) {
            throw new TestExecutionError(`No *.test.jsx file found under "${context.solutionCodePath}"`);
        }
        context.validatedTestFilePath = testFilePath;
    }
    async findTestFile(solutionCodePath) {
        const listResult = await this.fileSystem.listFilesRecursive(solutionCodePath);
        if (!listResult.ok) {
            return undefined;
        }
        return listResult.value.find((filePath) => TEST_FILE_EXTENSION_PATTERN.test(path.basename(filePath)));
    }
}
