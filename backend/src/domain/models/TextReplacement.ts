/**
 * A single literal, ordered, whole-string replacement applied to file contents.
 * Order matters: longer/more specific replacements must be listed before
 * shorter ones they overlap with (e.g. "bidNumber" before "bid") so a greedy
 * left-to-right apply doesn't clobber a longer match with a shorter one first.
 */
export interface TextReplacement {
  readonly from: string;
  readonly to: string;
}

/**
 * Maps an old file path (relative to a project root) to its new path.
 * Applied after content transformation, when the file is written out.
 */
export interface FileRename {
  readonly fromRelativePath: string;
  readonly toRelativePath: string;
}

/**
 * A single color swap. Kept as its own type (rather than reusing
 * TextReplacement) so rules can specifically validate "every declared
 * palette color was actually swapped" without conflating it with arbitrary
 * text replacements.
 */
export interface ColorSwap {
  readonly fromHex: string;
  readonly toHex: string;
}
