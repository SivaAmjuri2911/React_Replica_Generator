import type { GenerationRule, RuleEvaluationContext } from '../GenerationRule.js';
import { err, ok, type Result } from '../../shared/Result.js';
import { RuleViolationError } from '../../domain/errors/GenerationError.js';

/**
 * Enforces: every color declared in the scenario spec's colorSwaps was
 * actually swapped everywhere — no leftover old-palette hex values anywhere
 * in solution_code (source files and README alike).
 */
export class ColorPaletteCompletenessRule implements GenerationRule {
  readonly name = 'ColorPaletteCompletenessRule';

  async evaluate(context: RuleEvaluationContext): Promise<Result<void, RuleViolationError>> {
    const { spec, generatedProject, fileSystem } = context;

    if (spec.colorSwaps.length === 0) {
      return ok(undefined);
    }

    const filesResult = await fileSystem.listFilesRecursive(generatedProject.solutionCodePath);
    if (!filesResult.ok) {
      return err(new RuleViolationError(this.name, `Could not list solution_code files: ${filesResult.error.message}`));
    }

    const relevantFiles = filesResult.value.filter((filePath) =>
      /\.(jsx?|css|md|json)$/.test(filePath)
    );

    const leftovers: string[] = [];
    // Identity swaps (fromHex === toHex) mean "keep this color as-is" — the
    // color legitimately remains in the output, so it's not a leftover.
    const realSwaps = spec.colorSwaps.filter((swap) => swap.fromHex.toLowerCase() !== swap.toHex.toLowerCase());

    for (const filePath of relevantFiles) {
      const contentResult = await fileSystem.readFile(filePath);
      if (!contentResult.ok) {
        continue;
      }
      const lowerContent = contentResult.value.toLowerCase();
      for (const swap of realSwaps) {
        if (containsColorToken(lowerContent, swap.fromHex.toLowerCase())) {
          leftovers.push(`${filePath}: still contains old color "${swap.fromHex}"`);
        }
      }
    }

    if (leftovers.length > 0) {
      return err(
        new RuleViolationError(
          this.name,
          `Old-palette colors must not remain anywhere in solution_code. Found:\n${leftovers.join('\n')}`
        )
      );
    }

    return ok(undefined);
  }
}

const HEX_DIGIT = /[0-9a-f]/;

/**
 * Plain substring search wrongly flags e.g. "#fff" as present inside
 * "#ffffff" (shorthand hex is a prefix of the longhand form). For hex
 * tokens, require that the character right after each match isn't itself
 * a hex digit, so only standalone occurrences count.
 */
function containsColorToken(lowerContent: string, lowerToken: string): boolean {
  if (!lowerToken.startsWith('#')) {
    return lowerContent.includes(lowerToken);
  }

  let fromIndex = 0;
  for (;;) {
    const index = lowerContent.indexOf(lowerToken, fromIndex);
    if (index === -1) {
      return false;
    }
    const nextChar = lowerContent[index + lowerToken.length];
    if (nextChar === undefined || !HEX_DIGIT.test(nextChar)) {
      return true;
    }
    fromIndex = index + 1;
  }
}
