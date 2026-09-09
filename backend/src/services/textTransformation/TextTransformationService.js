/**
 * @typedef {object} TextTransformationService
 * @property {(source: string, replacements: readonly import('../../domain/models/TextReplacement.js').TextReplacement[]) => string} applyReplacements Applies every replacement in order, left to right — each replacement's output feeds the next, so an earlier replacement's target text can itself be matched by a later, more general replacement. Intentional for entity renames (see TextReplacement's doc comment: "bidNumber" before "bid" so a longer match isn't clobbered by a shorter, later one).
 * @property {(source: string, replacements: readonly import('../../domain/models/TextReplacement.js').TextReplacement[]) => string} applySimultaneousReplacements Applies every replacement against the ORIGINAL source in one pass — none of them can match text another one in the same batch produced. Required for color swaps: a real palette frequently has one entry's target hex equal to another entry's source hex (e.g. "#ffffff" -> "#f8fafc" and, separately, "#f8fafc" -> "#e2e8f0" for a different original color) — chaining would silently double-transform the first value into the second entry's target instead of stopping at its own.
 */

export {};
