import path from 'node:path';
import { err, ok } from '../../shared/Result.js';
import { RuleViolationError } from '../../domain/errors/GenerationError.js';
import { packageName } from '../../domain/models/ScenarioSpec.js';
/**
 * Enforces: prefilled_code, solution_code, and testcase must all declare the
 * exact same package.json "name" — never allowed to diverge.
 */
/**
 * @implements {GenerationRule}
 */
export class PackageJsonAlignmentRule {
    name = 'PackageJsonAlignmentRule';
    async evaluate(context) {
        const { spec, generatedProject, fileSystem } = context;
        const expectedName = packageName(spec);
        const packageJsonPaths = [
            path.join(generatedProject.prefilledCodePath, 'package.json'),
            path.join(generatedProject.solutionCodePath, 'package.json'),
            path.join(generatedProject.testcasePath, 'package.json'),
        ];
        const mismatches = [];
        for (const packageJsonPath of packageJsonPaths) {
            const readResult = await fileSystem.readFile(packageJsonPath);
            if (!readResult.ok) {
                return err(new RuleViolationError(this.name, `Could not read "${packageJsonPath}": ${readResult.error.message}`));
            }
            const parsed = JSON.parse(readResult.value);
            if (parsed.name !== expectedName) {
                mismatches.push(`${packageJsonPath} has name "${parsed.name ?? '<missing>'}"`);
            }
        }
        if (mismatches.length > 0) {
            return err(new RuleViolationError(this.name, `All package.json files must declare name "${expectedName}". Mismatches:\n${mismatches.join('\n')}`));
        }
        return ok(undefined);
    }
}
