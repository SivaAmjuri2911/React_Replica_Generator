import { err, ok } from '../../shared/Result.js';
import { RuleViolationError } from '../../domain/errors/GenerationError.js';

/**
 * @typedef {object} IdeBasedCodingDocument
 * @property {ReadonlyArray<{test_case_enum: string, display_text: string, weightage: number}>} test_cases
 */

/**
 * Final defense-in-depth check: re-derives test_cases from the on-disk
 * testcase test file and compares it against what actually ended up in the
 * written IDE_BASED_CODING JSON, catching any drift introduced between
 * derivation and file-write time.
 */
/**
 * @implements {GenerationRule}
 */
export class IdeBasedCodingJsonSyncRule {
    name = 'IdeBasedCodingJsonSyncRule';
    derivationService;
    constructor(derivationService) {
        this.derivationService = derivationService;
    }
    async evaluate(context) {
        const { spec, generatedProject, fileSystem } = context;
        const jsonResult = await fileSystem.readFile(generatedProject.ideBasedCodingJsonPath);
        if (!jsonResult.ok) {
            return err(new RuleViolationError(this.name, `Could not read generated JSON: ${jsonResult.error.message}`));
        }
        const parsedArray = JSON.parse(jsonResult.value);
        const document = parsedArray[0];
        if (!document) {
            return err(new RuleViolationError(this.name, 'Generated IDE_BASED_CODING JSON is empty'));
        }
        const testcaseFilesResult = await fileSystem.listFilesRecursive(generatedProject.testcasePath);
        if (!testcaseFilesResult.ok) {
            return err(new RuleViolationError(this.name, 'Could not list testcase files'));
        }
        const testFilePath = testcaseFilesResult.value.find((filePath) => /\.test\.jsx?$/.test(filePath));
        if (!testFilePath) {
            return err(new RuleViolationError(this.name, 'No test file found in testcase folder'));
        }
        const testFileContentResult = await fileSystem.readFile(testFilePath);
        if (!testFileContentResult.ok) {
            return err(new RuleViolationError(this.name, 'Could not read testcase test file'));
        }
        const derivedResult = this.derivationService.deriveFromTestFileContents(testFileContentResult.value, spec.testPrefix);
        if (!derivedResult.ok) {
            return err(new RuleViolationError(this.name, `Re-derivation failed: ${derivedResult.error.message}`));
        }
        const mismatch = this.diff(derivedResult.value, document.test_cases);
        if (mismatch) {
            return err(new RuleViolationError(this.name, mismatch));
        }
        return ok(undefined);
    }
    diff(derived, written) {
        if (derived.length !== written.length) {
            return `Test case count mismatch: derived ${derived.length}, written ${written.length}`;
        }
        for (let index = 0; index < derived.length; index += 1) {
            const derivedCase = derived[index];
            const writtenCase = written[index];
            if (!derivedCase || !writtenCase) {
                return `Missing test case at index ${index}`;
            }
            if (derivedCase.testCaseEnum !== writtenCase.test_case_enum ||
                derivedCase.displayText !== writtenCase.display_text ||
                derivedCase.weightage !== writtenCase.weightage) {
                return `Test case at index ${index} does not match: derived ${JSON.stringify(derivedCase)} vs written ${JSON.stringify(writtenCase)}`;
            }
        }
        return undefined;
    }
}
