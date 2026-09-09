/**
 * A single manually-authored file the draft wants staged verbatim — its full
 * new content, not a set of replacements (used for genuinely new content or
 * files where a token/color means two different things, see "the response
 * problem" in the README).
 * @typedef {object} ManuallyAuthoredFileDraft
 * @property {string} relativePath
 * @property {string} content
 */

/**
 * Everything an LLM can responsibly propose about a new scenario's
 * transformation. Deliberately excludes `paths` and `platformMetadata` —
 * those are operator-supplied (real filesystem locations and fixed platform
 * enums the model has no basis to invent), never model output. Merged with
 * those two into a full `ScenarioSpec` by `ScenarioSpecAuthoringWorkflow`.
 * @typedef {object} ScenarioSpecDraft
 * @property {string} scenarioName
 * @property {string} outputFolderBaseName
 * @property {string} testPrefix
 * @property {readonly import('./TextReplacement.js').TextReplacement[]} textReplacements
 * @property {readonly import('./TextReplacement.js').FileRename[]} fileRenames
 * @property {readonly import('./TextReplacement.js').ColorSwap[]} colorSwaps
 * @property {readonly string[]} transformableRelativePaths
 * @property {readonly ManuallyAuthoredFileDraft[]} manuallyAuthoredFiles
 */

export {};
