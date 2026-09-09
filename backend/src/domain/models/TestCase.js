/**
 * Mirrors one entry of the IDE_BASED_CODING JSON's `test_cases[]` array.
 * Always constructed by parsing the validated test file — never authored by
 * hand — so it can never disagree with what the test file actually asserts.
 * @typedef {object} TestCase
 * @property {string} testCaseEnum
 * @property {string} displayText
 * @property {number} weightage
 */

export function toIdeBasedCodingTestCase(testCase) {
    return {
        test_case_enum: testCase.testCaseEnum,
        display_text: testCase.displayText,
        weightage: testCase.weightage,
    };
}
