import { err, ok } from '../../shared/Result.js';
import { RuleViolationError } from '../../domain/errors/GenerationError.js';
const PLACEHOLDER_TOKEN_PATTERN = /PLACEHOLDER_[A-Z0-9_]*/g;
/**
 * Enforces: never emit broken PLACEHOLDER_* link tokens — seed-data images
 * should use working Unsplash URLs; static UI assets keep base URLs.
 */
/**
 * @implements {GenerationRule}
 */
export class NoPlaceholderLinksRule {
    name = 'NoPlaceholderLinksRule';
    async evaluate(context) {
        const { generatedProject, fileSystem } = context;
        const filesResult = await fileSystem.listFilesRecursive(generatedProject.solutionCodePath);
        if (!filesResult.ok) {
            return err(new RuleViolationError(this.name, `Could not list solution_code files: ${filesResult.error.message}`));
        }
        const offenders = [];
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
            return err(new RuleViolationError(this.name, `Placeholder link tokens are not allowed — use working URLs (fresh Unsplash links for seed-data images, or the base scenario's original URLs for static UI assets). Found:\n${offenders.join('\n')}`));
        }
        return ok(undefined);
    }
}
