import type { TextTransformationService } from './TextTransformationService.js';
import type { TextReplacement } from '../../domain/models/TextReplacement.js';

/**
 * Applies replacements as literal (non-regex) global substitutions, in the
 * order given. Literal split/join is used instead of a regex so replacement
 * strings never need escaping and can't be misinterpreted as regex syntax.
 *
 * Callers are responsible for ordering replacements so a longer/more-specific
 * match is applied before a shorter one it overlaps with (documented on
 * TextReplacement) — this service does not attempt to detect or resolve
 * overlapping replacements itself.
 */
export class OrderedReplacementTransformationService implements TextTransformationService {
  applyReplacements(source: string, replacements: readonly TextReplacement[]): string {
    return replacements.reduce(
      (current, replacement) => current.split(replacement.from).join(replacement.to),
      source
    );
  }

  applySimultaneousReplacements(source: string, replacements: readonly TextReplacement[]): string {
    if (replacements.length === 0) {
      return source;
    }

    // Longer "from" values win at a given position — same "more specific first"
    // principle as applyReplacements, just enforced by sort here instead of by
    // caller-supplied order, since simultaneous matching has no "later entry"
    // to rely on for precedence.
    const byDescendingLength = [...replacements]
      .filter((replacement) => replacement.from.length > 0)
      .sort((a, b) => b.from.length - a.from.length);

    let result = '';
    let index = 0;
    while (index < source.length) {
      const match = byDescendingLength.find((replacement) => source.startsWith(replacement.from, index));
      if (match) {
        result += match.to;
        index += match.from.length;
      } else {
        result += source[index];
        index += 1;
      }
    }
    return result;
  }
}
