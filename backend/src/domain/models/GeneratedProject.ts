import type { TestCase } from './TestCase.js';

/**
 * The filesystem output of a generation run — the four artifacts described
 * in GENERATION_RULES.md, plus the derived test cases kept alongside for
 * rules/reporting to inspect without re-parsing the test file.
 */
export interface GeneratedProject {
  readonly scenarioName: string;
  readonly prefilledCodePath: string;
  readonly solutionCodePath: string;
  readonly testcasePath: string;
  readonly ideBasedCodingJsonPath: string;
  readonly testCases: readonly TestCase[];
  readonly questionId: string;
  readonly ideSessionId: string;
}
