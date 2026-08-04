import type { Result } from '../../shared/Result.js';
import type { TestCaseParsingError } from '../../domain/errors/GenerationError.js';
import type { TestCase } from '../../domain/models/TestCase.js';

/**
 * Derives IDE_BASED_CODING `test_cases[]` entries directly from a validated
 * test file's `:::PREFIX_test_N:::description:::weightage:::` markers. This
 * is the mechanism that guarantees the JSON and the test file can never
 * disagree — the JSON is never hand-authored (see GENERATION_RULES.md).
 */
export interface TestCaseDerivationService {
  deriveFromTestFileContents(
    testFileContents: string,
    expectedPrefix: string
  ): Result<readonly TestCase[], TestCaseParsingError>;
}
