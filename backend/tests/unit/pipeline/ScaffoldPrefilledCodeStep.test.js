import { describe, expect, it } from 'vitest';
import { ScaffoldPrefilledCodeStep } from '../../../src/pipeline/steps/ScaffoldPrefilledCodeStep.js';
import { OrderedReplacementTransformationService } from '../../../src/services/textTransformation/OrderedReplacementTransformationService.js';
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
        textReplacements: [],
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
    it('skips file renames when the prefilled starter does not contain the source path', async () => {
        const fileSystem = new InMemoryFileSystemService();
        fileSystem.seed('/uploaded/prefilled_code/src/App.jsx', 'const App = () => <h1>Starter</h1>;\nexport default App;\n');
        fileSystem.seed('/uploaded/prefilled_code/package.json', '{"name":"starter"}\n');

        const step = new ScaffoldPrefilledCodeStep(
            fileSystem,
            new OrderedReplacementTransformationService(),
            { debug() {} },
        );

        const context = { spec: buildSpec() };
        await expect(step.execute(context)).resolves.toBeUndefined();
        expect(await fileSystem.exists('/output/VinylRecordStore/src/components/NewspaperCard/index.jsx')).toBe(false);
        expect(await fileSystem.exists('/output/VinylRecordStore/src/components/VinylRecordCard/index.jsx')).toBe(false);
        expect(context.prefilledCodePath?.replace(/\\/g, '/')).toBe('/output/VinylRecordStore');
    });

    it('applies file renames when the prefilled starter contains the source path', async () => {
        const fileSystem = new InMemoryFileSystemService();
        fileSystem.seed('/uploaded/prefilled_code/src/components/NewspaperCard/index.jsx', 'export default function Card() { return null; }\n');
        fileSystem.seed('/uploaded/prefilled_code/package.json', '{"name":"starter"}\n');

        const step = new ScaffoldPrefilledCodeStep(
            fileSystem,
            new OrderedReplacementTransformationService(),
            { debug() {} },
        );

        const context = { spec: buildSpec() };
        await step.execute(context);

        expect(await fileSystem.exists('/output/VinylRecordStore/src/components/NewspaperCard/index.jsx')).toBe(false);
        expect(await fileSystem.exists('/output/VinylRecordStore/src/components/VinylRecordCard/index.jsx')).toBe(true);
    });
});
