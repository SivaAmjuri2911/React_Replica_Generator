import path from 'node:path';

/**
 * @typedef {object} ScenarioPaths
 * @property {string} basePrefilledCode Base "prefilled_code" folder to copy as the new scenario's starter.
 * @property {string} baseSolutionCode Base "solution_code" folder to transform into the new scenario's solution.
 * @property {string} baseTestcase Base "testcase" folder — read-only reference, never copied wholesale (see rules).
 * @property {string} ideBasedCodingOutputDir Legacy spec field — kept in sync with outputRoot/IDE_BASED_CODING; JSON files are written as {uuid}.json inside that folder.
 * @property {string} outputRoot Root directory under which the three new scenario folders get created.
 * @property {string} stagingDir Directory holding pre-authored files (relative paths matching manuallyAuthoredRelativePaths) that get copied verbatim into solution_code instead of being derived by text transformation.
 */

/**
 * @typedef {object} PlatformMetadata
 * @property {string} contentType
 * @property {string} toughness
 * @property {string} language
 * @property {string} questionType
 * @property {string} questionFormat
 */

/**
 * The single source of truth for one generation run. Authoring this spec is
 * the one step that still requires judgment (deciding what an entity's
 * fields/labels/colors become) — everything downstream of a valid spec is
 * fully deterministic and enforced by the rules engine.
 * @typedef {object} ScenarioSpec
 * @property {string} scenarioName Kebab-case scenario identifier, e.g. "ticket-management". Drives the package.json name.
 * @property {string} outputFolderBaseName PascalCase base name for the three output folders, e.g. "TicketManagement" -> TicketManagement / TicketManagement_Solution / TicketManagement_tests.
 * @property {string} testPrefix Unique per-scenario test id prefix, e.g. "RJSCED22TM". Must differ from every previously used prefix.
 * @property {PlatformMetadata} platformMetadata
 * @property {ScenarioPaths} paths
 * @property {readonly import('./TextReplacement.js').TextReplacement[]} textReplacements Ordered, literal text replacements applied to every content file's contents. Order matters — see TextReplacement doc comment.
 * @property {readonly import('./TextReplacement.js').FileRename[]} fileRenames Relative-path renames applied within solution_code (and mirrored where relevant).
 * @property {readonly string[]} transformableRelativePaths Relative paths (within solution_code, using the *new* post-rename path) that receive textReplacements + colorSwaps. Every other copied file is left byte-for-byte untouched.
 * @property {readonly import('./TextReplacement.js').ColorSwap[]} colorSwaps The full color palette swap — every color used by the base scenario must appear here.
 * @property {readonly string[]} manuallyAuthoredRelativePaths Relative paths (within solution_code) whose content is NOT derived by mechanical text replacement — instead copied verbatim from paths.stagingDir.
 */

export function packageName(spec) {
    return `${spec.scenarioName}-project`;
}
export function outputPrefilledCodePath(spec) {
    return path.join(spec.paths.outputRoot, spec.outputFolderBaseName);
}
export function outputSolutionCodePath(spec) {
    return path.join(spec.paths.outputRoot, `${spec.outputFolderBaseName}_Solution`);
}
export function outputTestcasePath(spec) {
    return path.join(spec.paths.outputRoot, `${spec.outputFolderBaseName}_tests`);
}
export function outputIdeBasedCodingDir(spec) {
    return path.join(spec.paths.outputRoot, 'IDE_BASED_CODING');
}
export function outputIdeBasedCodingPath(spec, questionId) {
    return path.join(outputIdeBasedCodingDir(spec), `${questionId}.json`);
}
