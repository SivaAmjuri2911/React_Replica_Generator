import { TestExecutionError } from '../../domain/errors/GenerationError.js';
/**
 * Defensive final gate: re-runs the solution's tests one more time after
 * every other step has completed, so any accidental corruption introduced
 * between the first validation pass (ValidateSolutionTestsStep) and now
 * (e.g. a bug in a later step touching solution_code) is caught before the
 * generation run is reported as successful.
 */
/**
 * @implements {PipelineStep}
 */
export class FinalValidationStep {
    name = 'FinalValidationStep';
    testRunner;
    constructor(testRunner) {
        this.testRunner = testRunner;
    }
    async execute(context) {
        if (!context.solutionCodePath) {
            throw new TestExecutionError('solutionCodePath is not set');
        }
        const testResult = await this.testRunner.runTests(context.solutionCodePath);
        if (!testResult.ok) {
            throw testResult.error;
        }
        if (!testResult.value.passed) {
            throw new TestExecutionError(`Final validation failed: ${testResult.value.passedTests}/${testResult.value.totalTests} passed after all pipeline steps completed`, { rawOutput: testResult.value.rawOutput });
        }
    }
}
