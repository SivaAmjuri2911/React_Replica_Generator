import { describe, expect, it } from 'vitest';
import {
    enforceDeterministicTestFilesOnStructure,
    enforceSeedDataFilesOnStructure,
    extractBaseTestPrefix,
    fileContainsLeadingSeedDataArray,
    finalizeScenarioSpecDraft,
    normalizeTestFileMarkers,
} from '../../../src/services/scenarioSpecGeneration/baseTestFileUtils.js';

describe('baseTestFileUtils', () => {
    const baseFiles = [{
        relativePath: 'src/__tests__/Main.test.jsx',
        contents: "it(':::RJSCEP7M4A_TEST_1:::loads newspapers:::5:::', () => {});",
    }];

    it('extracts the test prefix from legacy TEST markers in the base file', () => {
        expect(extractBaseTestPrefix(baseFiles)).toBe('RJSCEP7M4A');
    });

    it('normalizes legacy TEST markers to canonical test markers', () => {
        expect(normalizeTestFileMarkers(
            "it(':::RJSCEP7M4A_TEST_1:::loads newspapers:::5:::', () => {});",
            'RJSCEP7M4A',
        )).toBe("it(':::RJSCEP7M4A_test_1:::loads newspapers:::5:::', () => {});");
    });

    it('forces test files onto transformable paths and removes AI-authored test content', () => {
        const finalized = finalizeScenarioSpecDraft(
            { baseSolutionCodeFiles: baseFiles, usedTestPrefixes: ['VNYLCR58QM'] },
            {
                scenarioName: 'vinyl-record-store',
                outputFolderBaseName: 'VinylRecordStore',
                testPrefix: 'VNYLCR58QM',
                textReplacements: [{ from: 'newspaper', to: 'record' }],
                fileRenames: [],
                colorSwaps: [],
                transformableRelativePaths: ['src/App.jsx'],
                manuallyAuthoredFiles: [{
                    relativePath: 'src/__tests__/Main.test.jsx',
                    content: "it(':::VNYLCR58QM_test_13:::broken:::5:::', () => {});",
                }],
            },
        );

        expect(finalized.testPrefix).toBe('RJSCEP7M4A');
        expect(finalized.transformableRelativePaths).toContain('src/__tests__/Main.test.jsx');
        expect(finalized.manuallyAuthoredFiles).toEqual([]);
    });

    it('maps renamed base test files to their post-rename transformable path', () => {
        const structure = enforceDeterministicTestFilesOnStructure(
            { baseSolutionCodeFiles: [{
                relativePath: 'src/__tests__/Bid.test.jsx',
                contents: "it(':::RJSCED18BN_TEST_1:::x:::5:::', () => {});",
            }], usedTestPrefixes: [] },
            {
                scenarioName: 'equipment-rental',
                outputFolderBaseName: 'EquipmentRental',
                testPrefix: 'RJSCED22ER',
                textReplacements: [],
                fileRenames: [{
                    fromRelativePath: 'src/__tests__/Bid.test.jsx',
                    toRelativePath: 'src/__tests__/Rental.test.jsx',
                }],
                colorSwaps: [],
                transformableRelativePaths: [],
                manuallyAuthoredRelativePaths: ['src/__tests__/Rental.test.jsx', 'readme.md'],
            },
        );

        expect(structure.testPrefix).toBe('RJSCED18BN');
        expect(structure.transformableRelativePaths).toContain('src/__tests__/Rental.test.jsx');
        expect(structure.manuallyAuthoredRelativePaths).toEqual(['readme.md']);
    });

    it('detects leading seed-data arrays after imports', () => {
        expect(fileContainsLeadingSeedDataArray(`import './App.css';

const articles = [{ id: '1' }];
`)).toBe(true);
        expect(fileContainsLeadingSeedDataArray('const App = () => null;\n')).toBe(false);
    });

    it('moves seed-data files off transformable paths during structure finalize', () => {
        const structure = enforceSeedDataFilesOnStructure(
            {
                baseSolutionCodeFiles: [{
                    relativePath: 'src/App.jsx',
                    contents: `import './App.css';

const articles = [{ id: '1', title: 'Daily News' }];
export default function App() { return null; }
`,
                }],
                usedTestPrefixes: [],
            },
            {
                scenarioName: 'vinyl-record-store',
                outputFolderBaseName: 'VinylRecordStore',
                testPrefix: 'VNYL',
                textReplacements: [{ from: 'articles', to: 'records' }],
                fileRenames: [],
                colorSwaps: [],
                transformableRelativePaths: ['src/App.jsx', 'src/App.css'],
                manuallyAuthoredRelativePaths: ['src/components/HomePage/index.jsx'],
            },
        );

        expect(structure.transformableRelativePaths).toEqual(['src/App.css']);
        expect(structure.manuallyAuthoredRelativePaths).toEqual([
            'src/components/HomePage/index.jsx',
            'src/App.jsx',
        ]);
    });

    it('rejects finalized drafts that leave seed-data files transformable-only', () => {
        expect(() => finalizeScenarioSpecDraft(
            {
                baseSolutionCodeFiles: [{
                    relativePath: 'src/App.jsx',
                    contents: `const articles = [{ id: '1' }];\n`,
                }],
                usedTestPrefixes: [],
            },
            {
                scenarioName: 'vinyl-record-store',
                outputFolderBaseName: 'VinylRecordStore',
                testPrefix: 'VNYL',
                textReplacements: [],
                fileRenames: [],
                colorSwaps: [],
                transformableRelativePaths: ['src/App.jsx'],
                manuallyAuthoredFiles: [],
            },
        )).toThrow(/Seed-data files must be manually authored/);
    });
});
