/**
 * The filesystem output of a generation run — the four artifacts described
 * in GENERATION_RULES.md, plus the derived test cases kept alongside for
 * rules/reporting to inspect without re-parsing the test file.
 * @typedef {object} GeneratedProject
 * @property {string} scenarioName
 * @property {string} prefilledCodePath
 * @property {string} solutionCodePath
 * @property {string} testcasePath
 * @property {string} ideBasedCodingJsonPath
 * @property {readonly import('./TestCase.js').TestCase[]} testCases
 * @property {string} questionId
 * @property {string} ideSessionId
 */

export {};
