import path from 'node:path';
import { FileSystemError } from '../../domain/errors/GenerationError.js';
import { normalizeTestFileMarkers } from '../../services/scenarioSpecGeneration/baseTestFileUtils.js';
const TEST_FILE_EXTENSION_PATTERN = /\.test\.jsx?$/;
/**
 * Derives the IDE_BASED_CODING test_cases[] directly from the promoted
 * testcase test file's markers — never hand-authored (see
 * scripts/build-test-cases-json.js, which this service is the typed,
 * tested successor to).
 */
/**
 * @implements {PipelineStep}
 */
export class DeriveTestCasesStep {
    name = 'DeriveTestCasesStep';
    fileSystem;
    derivationService;
    constructor(fileSystem, derivationService) {
        this.fileSystem = fileSystem;
        this.derivationService = derivationService;
    }
    async execute(context) {
        if (!context.testcasePath) {
            throw new FileSystemError('testcasePath is not set — PromoteTestsToTestcaseStep must run first');
        }
        const listResult = await this.fileSystem.listFilesRecursive(context.testcasePath);
        if (!listResult.ok) {
            throw listResult.error;
        }
        const testFilePath = listResult.value.find((filePath) => TEST_FILE_EXTENSION_PATTERN.test(path.basename(filePath)));
        if (!testFilePath) {
            throw new FileSystemError(`No *.test.jsx file found under "${context.testcasePath}"`);
        }
        const contentResult = await this.fileSystem.readFile(testFilePath);
        if (!contentResult.ok) {
            throw contentResult.error;
        }
        const normalizedContent = normalizeTestFileMarkers(contentResult.value, context.spec.testPrefix);
        const derivedResult = this.derivationService.deriveFromTestFileContents(normalizedContent, context.spec.testPrefix);
        if (!derivedResult.ok) {
            throw derivedResult.error;
        }
        context.testCases = derivedResult.value;
    }
}
