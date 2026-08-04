import type { GenerationRule, RuleEvaluationContext } from '../GenerationRule.js';
import { err, ok, type Result } from '../../shared/Result.js';
import { RuleViolationError } from '../../domain/errors/GenerationError.js';

const PLACEHOLDER_TOKEN_PATTERN = /PLACEHOLDER_[A-Z0-9_]*/g;

/**
 * Enforces: design assets (video/screenshots/logo) that can't be
 * auto-generated must fall back to the base scenario's original working
 * URLs, never a broken PLACEHOLDER_* marker string.
 */
export class NoPlaceholderLinksRule implements GenerationRule {
  readonly name = 'NoPlaceholderLinksRule';

  async evaluate(context: RuleEvaluationContext): Promise<Result<void, RuleViolationError>> {
    const { generatedProject, fileSystem } = context;

    const filesResult = await fileSystem.listFilesRecursive(generatedProject.solutionCodePath);
    if (!filesResult.ok) {
      return err(new RuleViolationError(this.name, `Could not list solution_code files: ${filesResult.error.message}`));
    }

    const offenders: string[] = [];

    for (const filePath of filesResult.value) {
      const contentResult = await fileSystem.readFile(filePath);
      if (!contentResult.ok) {
        continue;
      }
      const matches = contentResult.value.match(PLACEHOLDER_TOKEN_PATTERN);
      if (matches && matches.length > 0) {
        offenders.push(`${filePath}: ${[...new Set(matches)].join(', ')}`);
      }
    }

    if (offenders.length > 0) {
      return err(
        new RuleViolationError(
          this.name,
          `Placeholder link tokens are not allowed — use the base scenario's original URLs instead. Found:\n${offenders.join('\n')}`
        )
      );
    }

    return ok(undefined);
  }
}
