import { err, ok } from '../../shared/Result.js';
import { TestCaseParsingError } from '../../domain/errors/GenerationError.js';
const MARKER_PATTERN = /:::([A-Za-z0-9]+)_test_(\d+):::([\s\S]*?):::(\d+):::/g;
/**
 * @implements {TestCaseDerivationService}
 */
export class MarkerBasedTestCaseDerivationService {
    deriveFromTestFileContents(testFileContents, expectedPrefix) {
        const testCases = [];
        const seenEnums = new Set();
        for (const match of testFileContents.matchAll(MARKER_PATTERN)) {
            const [, prefix, testNumber, description, weightageText] = match;
            if (!prefix || !testNumber || description === undefined || !weightageText) {
                continue;
            }
            if (prefix !== expectedPrefix) {
                return err(new TestCaseParsingError(`Test marker uses prefix "${prefix}" but the scenario spec declares "${expectedPrefix}"`, { foundPrefix: prefix, expectedPrefix }));
            }
            const testCaseEnum = `${prefix}_test_${testNumber}`;
            if (seenEnums.has(testCaseEnum)) {
                return err(new TestCaseParsingError(`Duplicate test_case_enum found: "${testCaseEnum}"`, { testCaseEnum }));
            }
            seenEnums.add(testCaseEnum);
            testCases.push({
                testCaseEnum,
                displayText: `${description}:::${weightageText}:::`,
                weightage: Number(weightageText),
            });
        }
        if (testCases.length === 0) {
            return err(new TestCaseParsingError('No test markers found. Expected format: :::PREFIX_test_N:::description:::weightage:::', {}));
        }
        const sequenceError = this.validateSequentialNumbering(testCases);
        if (sequenceError) {
            return err(sequenceError);
        }
        return ok(testCases);
    }
    validateSequentialNumbering(testCases) {
        for (const [index, testCase] of testCases.entries()) {
            const expectedNumber = index + 1;
            const actualNumber = Number(testCase.testCaseEnum.split('_test_')[1]);
            if (actualNumber !== expectedNumber) {
                return new TestCaseParsingError(`Test numbering is not sequential at position ${index}: expected _test_${expectedNumber}, found "${testCase.testCaseEnum}"`, { index, expectedNumber, actualEnum: testCase.testCaseEnum });
            }
        }
        return undefined;
    }
}
