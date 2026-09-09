import { describe, expect, it } from 'vitest';
import { PromoteTestsToTestcaseStep } from '../../../src/pipeline/steps/PromoteTestsToTestcaseStep.js';
import { PipelineContext } from '../../../src/pipeline/PipelineContext.js';
import { InMemoryFileSystemService } from '../fakes/InMemoryFileSystemService.js';
const TEST_FILE_CONTENT = 'describe("PlantNursery", () => {});';
function buildSpec() {
    return {
        scenarioName: 'plant-nursery-shop',
        outputFolderBaseName: 'PlantNurseryShop',
        testPrefix: 'ABC',
        platformMetadata: {
            contentType: 'MARKDOWN',
            toughness: 'EASY',
            language: 'ENGLISH',
            questionType: 'IDE_BASED_CODING',
            questionFormat: 'CODING_PRACTICE',
        },
        paths: {
            basePrefilledCode: '/base/prefilled',
            baseSolutionCode: '/base/solution',
            baseTestcase: '/base/testcase',
            ideBasedCodingOutputDir: '/out/json',
            outputRoot: '/out',
            stagingDir: '/staging',
        },
        textReplacements: [],
        fileRenames: [],
        transformableRelativePaths: [],
        colorSwaps: [],
        manuallyAuthoredRelativePaths: [],
    };
}
/**
 * Seeds the base testcase template (whose test file still carries the template
 * scenario's name) plus the already-validated solution_code test file.
 */
function seedBase(fileSystem, baseTestFileName) {
    fileSystem.seed('/base/testcase/package.json', JSON.stringify({ name: 'bid-project' }, null, 2));
    fileSystem.seed('/base/testcase/vite.config.js', 'export default {};');
    fileSystem.seed(`/base/testcase/src/__tests__/${baseTestFileName}`, 'describe("Bid", () => {});');
    const validatedTestFilePath = '/out/PlantNurseryShop_Solution/src/__tests__/Main.test.jsx';
    fileSystem.seed(validatedTestFilePath, TEST_FILE_CONTENT);
    return validatedTestFilePath;
}
describe('PromoteTestsToTestcaseStep', () => {
    it("names the promoted test file after solution_code's test file, not the base template's", async () => {
        const fileSystem = new InMemoryFileSystemService();
        const context = new PipelineContext(buildSpec());
        context.validatedTestFilePath = seedBase(fileSystem, 'Bid.test.jsx');
        await new PromoteTestsToTestcaseStep(fileSystem).execute(context);
        const promoted = await fileSystem.readFile('/out/PlantNurseryShop_tests/src/__tests__/Main.test.jsx');
        expect(promoted.ok).toBe(true);
        if (promoted.ok) {
            expect(promoted.value).toBe(TEST_FILE_CONTENT);
        }
        // The template's own name must not survive alongside it — two *.test.jsx files
        // would both be picked up by the testcase harness's `**/*.test.*` include glob.
        expect(await fileSystem.exists('/out/PlantNurseryShop_tests/src/__tests__/Bid.test.jsx')).toBe(false);
    });
    it('leaves the path alone when the base template already uses the same test file name', async () => {
        const fileSystem = new InMemoryFileSystemService();
        const context = new PipelineContext(buildSpec());
        context.validatedTestFilePath = seedBase(fileSystem, 'Main.test.jsx');
        await new PromoteTestsToTestcaseStep(fileSystem).execute(context);
        const promoted = await fileSystem.readFile('/out/PlantNurseryShop_tests/src/__tests__/Main.test.jsx');
        expect(promoted.ok).toBe(true);
        if (promoted.ok) {
            expect(promoted.value).toBe(TEST_FILE_CONTENT);
        }
    });
    it("renames package.json to the scenario's own package name", async () => {
        const fileSystem = new InMemoryFileSystemService();
        const context = new PipelineContext(buildSpec());
        context.validatedTestFilePath = seedBase(fileSystem, 'Bid.test.jsx');
        await new PromoteTestsToTestcaseStep(fileSystem).execute(context);
        const packageJson = await fileSystem.readFile('/out/PlantNurseryShop_tests/package.json');
        expect(packageJson.ok).toBe(true);
        if (packageJson.ok) {
            expect(JSON.parse(packageJson.value).name).toBe('plant-nursery-shop-project');
        }
    });
});
