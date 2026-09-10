import { describe, expect, it } from 'vitest';
import { ScaffoldPrefilledCodeStep } from '../../../src/pipeline/steps/ScaffoldPrefilledCodeStep.js';
import { InMemoryFileSystemService } from '../fakes/InMemoryFileSystemService.js';

function buildSpec(overrides = {}) {
    return {
        scenarioName: 'vinyl-record-store',
        outputFolderBaseName: 'VinylRecordStore',
        testPrefix: 'VNYL',
        platformMetadata: {
            contentType: 'MARKDOWN',
            toughness: 'EASY',
            language: 'ENGLISH',
            questionType: 'IDE_BASED_CODING',
            questionFormat: 'CODING_PRACTICE',
        },
        paths: {
            basePrefilledCode: '/uploaded/prefilled_code',
            baseSolutionCode: '/uploaded/solution_code',
            baseTestcase: '/templates/testcase',
            ideBasedCodingOutputDir: '/output/json',
            outputRoot: '/output',
            stagingDir: '/staging',
        },
        textReplacements: [{ from: 'articles', to: 'records' }],
        fileRenames: [{
            fromRelativePath: 'src/components/NewspaperCard/index.jsx',
            toRelativePath: 'src/components/VinylRecordCard/index.jsx',
        }],
        transformableRelativePaths: ['src/App.jsx'],
        colorSwaps: [],
        manuallyAuthoredRelativePaths: [],
        ...overrides,
    };
}

describe('ScaffoldPrefilledCodeStep', () => {
    it('copies prefilled unchanged except package name — no renames or text replacements', async () => {
        const fileSystem = new InMemoryFileSystemService();
        fileSystem.seed('/uploaded/prefilled_code/src/App.jsx', 'const articles = [];\nconst App = () => <h1>Starter</h1>;\nexport default App;\n');
        fileSystem.seed('/uploaded/prefilled_code/src/components/NewspaperCard/index.jsx', 'export default function Card() { return null; }\n');
        fileSystem.seed('/uploaded/prefilled_code/package.json', '{"name":"starter"}\n');

        const step = new ScaffoldPrefilledCodeStep(fileSystem, { debug() {} });
        const context = { spec: buildSpec() };
        await step.execute(context);

        const appResult = await fileSystem.readFile('/output/VinylRecordStore/src/App.jsx');
        expect(appResult.ok).toBe(true);
        if (appResult.ok) {
            expect(appResult.value).toContain('articles');
            expect(appResult.value).not.toContain('records');
        }
        expect(await fileSystem.exists('/output/VinylRecordStore/src/components/NewspaperCard/index.jsx')).toBe(true);
        expect(await fileSystem.exists('/output/VinylRecordStore/src/components/VinylRecordCard/index.jsx')).toBe(false);

        const packageResult = await fileSystem.readFile('/output/VinylRecordStore/package.json');
        expect(packageResult.ok).toBe(true);
        if (packageResult.ok) {
            expect(packageResult.value).toContain('"name": "vinyl-record-store-project"');
        }
    });
});
