/**
 * Mirrors one entry of the IDE_BASED_CODING JSON's `test_cases[]` array.
 * Always constructed by parsing the validated test file — never authored by
 * hand — so it can never disagree with what the test file actually asserts.
 */
export interface TestCase {
  readonly testCaseEnum: string;
  readonly displayText: string;
  readonly weightage: number;
}

export function toIdeBasedCodingTestCase(testCase: TestCase): {
  test_case_enum: string;
  display_text: string;
  weightage: number;
} {
  return {
    test_case_enum: testCase.testCaseEnum,
    display_text: testCase.displayText,
    weightage: testCase.weightage,
  };
}
