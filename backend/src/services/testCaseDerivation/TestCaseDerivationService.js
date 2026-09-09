/**
 * Derives IDE_BASED_CODING `test_cases[]` entries directly from a validated
 * test file's `:::PREFIX_test_N:::description:::weightage:::` markers. This
 * is the mechanism that guarantees the JSON and the test file can never
 * disagree — the JSON is never hand-authored (see GENERATION_RULES.md).
 * @typedef {object} TestCaseDerivationService
 * @property {(testFileContents: string, expectedPrefix: string) => import('../../shared/Result.js').Result<readonly import('../../domain/models/TestCase.js').TestCase[], import('../../domain/errors/GenerationError.js').TestCaseParsingError>} deriveFromTestFileContents
 */

export {};
