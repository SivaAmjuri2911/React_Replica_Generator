import type { GenerationRule, RuleEvaluationContext } from '../GenerationRule.js';
import { err, ok, type Result } from '../../shared/Result.js';
import { RuleViolationError } from '../../domain/errors/GenerationError.js';

const JSX_FILE_PATTERN = /\.(jsx|tsx)$/;
const MIN_SLUG_LENGTH = 2;

/**
 * Enforces the most common way a generated scenario's own tests fail: a
 * page component gets renamed (e.g. "PODPage.jsx" -> "ItemsPage.jsx",
 * display text "POD" -> "Items") but its route path — a separate, usually
 * lowercase literal like <Route path="/pod"> or <Link to="/pod"> — never
 * gets updated, because it doesn't contain the capitalized word the entity
 * rename targeted. Caught this exact bug twice in real generations before
 * this rule existed (both times: the base scenario's "/pod", "/vendor",
 * "/user" routes survived unchanged into the renamed output). The system
 * prompt now asks the model to fix this itself (see
 * scenarioSpecDraftContract.ts, rule 11) — this rule is the deterministic
 * backstop for when it doesn't.
 */
export class RouteRenameConsistencyRule implements GenerationRule {
  readonly name = 'RouteRenameConsistencyRule';

  async evaluate(context: RuleEvaluationContext): Promise<Result<void, RuleViolationError>> {
    const { spec, generatedProject, fileSystem } = context;

    const routeSlugs = [...new Set(spec.fileRenames.flatMap((rename) => this.deriveRouteSlugs(rename.fromRelativePath)))];

    if (routeSlugs.length === 0) {
      return ok(undefined);
    }

    const filesResult = await fileSystem.listFilesRecursive(generatedProject.solutionCodePath);
    if (!filesResult.ok) {
      return err(new RuleViolationError(this.name, `Could not list solution_code files: ${filesResult.error.message}`));
    }

    const offenders: string[] = [];

    for (const filePath of filesResult.value) {
      if (!JSX_FILE_PATTERN.test(filePath)) {
        continue;
      }
      const contentResult = await fileSystem.readFile(filePath);
      if (!contentResult.ok) {
        continue;
      }

      for (const slug of routeSlugs) {
        // Matches a route-shaped literal only — a quote/backtick, a leading "/", the
        // slug, then a boundary (closing quote, another "/" for nesting, or ":" for a
        // dynamic segment) — so this can't fire on unrelated prose that happens to
        // contain the slug as a substring.
        const routeLiteralPattern = new RegExp(`["'\`]/${this.escapeRegExp(slug)}(?=["'\`/:])`, 'i');
        if (routeLiteralPattern.test(contentResult.value)) {
          offenders.push(`${filePath}: still references the base scenario's route "/${slug}"`);
        }
      }
    }

    if (offenders.length > 0) {
      return err(
        new RuleViolationError(
          this.name,
          `A renamed page's route path was never updated to match — the base scenario's original URL literal still appears in generated code even though the component/display text was renamed. Every <Route path>, <Link to>, href, or navigate() using that path needs its own textReplacements entry (this is a separate literal from the capitalized entity name). Found:\n${offenders.join('\n')}`
        )
      );
    }

    return ok(undefined);
  }

  /**
   * "PODPage.jsx" -> ["pod"]. "BidDetailPage.jsx" -> ["biddetail", "bid"] — list/detail pages
   * often route on just the bare entity name (e.g. "/bid/:id" for "BidDetailPage.jsx", not
   * "/biddetail/:id"), so this returns both the "strip trailing Page" candidate and, when a
   * List/Detail suffix is present, the bare-entity candidate underneath it too. Returns an empty
   * array for names this heuristic can't meaningfully derive a route slug from.
   */
  private deriveRouteSlugs(fromRelativePath: string): string[] {
    const basename = fromRelativePath.split('/').pop();
    if (!basename) {
      return [];
    }
    const withoutExtension = basename.replace(/\.(jsx|tsx|js|ts|css)$/, '');

    const candidates = new Set<string>();
    const withoutPageSuffix = withoutExtension.replace(/Page$/i, '');
    if (withoutPageSuffix.length >= MIN_SLUG_LENGTH) {
      candidates.add(withoutPageSuffix.toLowerCase());
    }
    const withoutListOrDetailSuffix = withoutExtension.replace(/(List|Detail)Page$/i, '');
    if (withoutListOrDetailSuffix.length >= MIN_SLUG_LENGTH && withoutListOrDetailSuffix !== withoutExtension) {
      candidates.add(withoutListOrDetailSuffix.toLowerCase());
    }
    return [...candidates];
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
