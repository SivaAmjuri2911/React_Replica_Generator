import path from 'node:path';
import { err, ok } from '../../shared/Result.js';
import { RuleViolationError } from '../../domain/errors/GenerationError.js';
const TEST_FILE_EXTENSION_PATTERN = /\.test\.jsx?$/;
const PACKAGE_JSON_FILENAME = 'package.json';
/**
 * Enforces the single strictest rule in GENERATION_RULES.md: nothing in the
 * `testcase` folder is authored directly. Every file must be byte-identical
 * to the base `testcase` folder except:
 *   - package.json's "name" field (checked by PackageJsonAlignmentRule, not here)
 *   - the *.test.jsx file (which is a copy promoted from solution_code, checked
 *     by TestFileParityRule, not here)
 */
/**
 * @implements {GenerationRule}
 */
export class TestcaseFolderImmutabilityRule {
    name = 'TestcaseFolderImmutabilityRule';
    async evaluate(context) {
        const { spec, generatedProject, fileSystem } = context;
        const baseFilesResult = await fileSystem.listFilesRecursive(spec.paths.baseTestcase);
        if (!baseFilesResult.ok) {
            return err(new RuleViolationError(this.name, `Could not list base testcase files: ${baseFilesResult.error.message}`));
        }
        const mismatches = [];
        for (const baseFilePath of baseFilesResult.value) {
            const relativePath = path.relative(spec.paths.baseTestcase, baseFilePath);
            const generatedFilePath = path.join(generatedProject.testcasePath, relativePath);
            const fileName = path.basename(relativePath);
            const isExemptFromByteMatch = fileName === PACKAGE_JSON_FILENAME || TEST_FILE_EXTENSION_PATTERN.test(fileName);
            if (isExemptFromByteMatch) {
                continue;
            }
            const baseContentResult = await fileSystem.readFile(baseFilePath);
            const generatedContentResult = await fileSystem.readFile(generatedFilePath);
            if (!baseContentResult.ok || !generatedContentResult.ok) {
                mismatches.push(`${relativePath}: missing from generated testcase folder`);
                continue;
            }
            if (baseContentResult.value !== generatedContentResult.value) {
                mismatches.push(`${relativePath}: content differs from base testcase folder`);
            }
        }
        if (mismatches.length > 0) {
            return err(new RuleViolationError(this.name, `The testcase folder must be untouched except package.json's name field and the test file. Violations:\n${mismatches.join('\n')}`));
        }
        return ok(undefined);
    }
}
