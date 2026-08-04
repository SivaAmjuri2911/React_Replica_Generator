import path from 'node:path';
import type { ColorSwap, FileRename, TextReplacement } from './TextReplacement.js';

export interface ScenarioPaths {
  /** Base "prefilled_code" folder to copy as the new scenario's starter. */
  readonly basePrefilledCode: string;
  /** Base "solution_code" folder to transform into the new scenario's solution. */
  readonly baseSolutionCode: string;
  /** Base "testcase" folder — read-only reference, never copied wholesale (see rules). */
  readonly baseTestcase: string;
  /** Directory to write the new IDE_BASED_CODING JSON into. */
  readonly ideBasedCodingOutputDir: string;
  /** Root directory under which the three new scenario folders get created. */
  readonly outputRoot: string;
  /**
   * Directory holding pre-authored files (relative paths matching
   * `manuallyAuthoredRelativePaths`) that get copied verbatim into
   * solution_code instead of being derived by text transformation — used for
   * genuinely new content (e.g. sampleData.js's actual records) that a
   * find/replace pass cannot produce.
   */
  readonly stagingDir: string;
}

export interface PlatformMetadata {
  readonly contentType: string;
  readonly toughness: string;
  readonly language: string;
  readonly questionType: string;
  readonly questionFormat: string;
}

/**
 * The single source of truth for one generation run. Authoring this spec is
 * the one step that still requires judgment (deciding what an entity's
 * fields/labels/colors become) — everything downstream of a valid spec is
 * fully deterministic and enforced by the rules engine.
 */
export interface ScenarioSpec {
  /** Kebab-case scenario identifier, e.g. "ticket-management". Drives the package.json name. */
  readonly scenarioName: string;
  /** PascalCase base name for the three output folders, e.g. "TicketManagement" → TicketManagement / TicketManagement_Solution / TicketManagement_tests. */
  readonly outputFolderBaseName: string;
  /** Unique per-scenario test id prefix, e.g. "RJSCED22TM". Must differ from every previously used prefix. */
  readonly testPrefix: string;
  readonly platformMetadata: PlatformMetadata;
  readonly paths: ScenarioPaths;
  /**
   * Ordered, literal text replacements applied to every content file's contents.
   * Order matters — see TextReplacement doc comment.
   */
  readonly textReplacements: readonly TextReplacement[];
  /** Relative-path renames applied within solution_code (and mirrored where relevant). */
  readonly fileRenames: readonly FileRename[];
  /**
   * Relative paths (within solution_code, using the *new* post-rename path)
   * that receive textReplacements + colorSwaps. Every other copied file is
   * left byte-for-byte untouched (boilerplate/config) — the pipeline never
   * guesses which files are "content" vs "boilerplate", the spec says so
   * explicitly.
   */
  readonly transformableRelativePaths: readonly string[];
  /** The full color palette swap — every color used by the base scenario must appear here. */
  readonly colorSwaps: readonly ColorSwap[];
  /**
   * Relative paths (within solution_code) whose content is NOT derived by
   * mechanical text replacement — instead copied verbatim from
   * `paths.stagingDir` (e.g. sampleData.js's actual new records, which
   * require genuinely new authored content, not a find/replace pass).
   */
  readonly manuallyAuthoredRelativePaths: readonly string[];
}

export function packageName(spec: ScenarioSpec): string {
  return `${spec.scenarioName}-project`;
}

export function outputPrefilledCodePath(spec: ScenarioSpec): string {
  return path.join(spec.paths.outputRoot, spec.outputFolderBaseName);
}

export function outputSolutionCodePath(spec: ScenarioSpec): string {
  return path.join(spec.paths.outputRoot, `${spec.outputFolderBaseName}_Solution`);
}

export function outputTestcasePath(spec: ScenarioSpec): string {
  return path.join(spec.paths.outputRoot, `${spec.outputFolderBaseName}_tests`);
}
