import type { ColorSwap, FileRename, TextReplacement } from './TextReplacement.js';

/**
 * A single manually-authored file the draft wants staged verbatim — its full
 * new content, not a set of replacements (used for genuinely new content or
 * files where a token/color means two different things, see "the response
 * problem" in the README).
 */
export interface ManuallyAuthoredFileDraft {
  readonly relativePath: string;
  readonly content: string;
}

/**
 * Everything an LLM can responsibly propose about a new scenario's
 * transformation. Deliberately excludes `paths` and `platformMetadata` —
 * those are operator-supplied (real filesystem locations and fixed platform
 * enums the model has no basis to invent), never model output. Merged with
 * those two into a full `ScenarioSpec` by `ScenarioSpecAuthoringWorkflow`.
 */
export interface ScenarioSpecDraft {
  readonly scenarioName: string;
  readonly outputFolderBaseName: string;
  readonly testPrefix: string;
  readonly textReplacements: readonly TextReplacement[];
  readonly fileRenames: readonly FileRename[];
  readonly colorSwaps: readonly ColorSwap[];
  readonly transformableRelativePaths: readonly string[];
  readonly manuallyAuthoredFiles: readonly ManuallyAuthoredFileDraft[];
}
