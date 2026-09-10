import { describe, expect, it } from 'vitest';
import {
    extractBaseTestPrefix,
    finalizeScenarioSpecDraft,
    rewriteTestMarkersToPrefix,
} from '../../../src/services/scenarioSpecGeneration/baseTestFileUtils.js';

describe('baseTestFileUtils', () => {
    const baseFiles = [{
        relativePath: 'src/__tests__/Bid.test.jsx',
        contents: "it(':::RJSCED18BN_test_1:::loads bids:::5:::', () => {});",
    }];

    it('extracts the test prefix from the base solution test file', () => {
        expect(extractBaseTestPrefix(baseFiles)).toBe('RJSCED18BN');
    });

    it('rewrites invented test markers back to the base prefix', () => {
        expect(rewriteTestMarkersToPrefix(
            "it(':::RJSCED22ER_test_1:::loads rentals:::5:::', () => {});",
            'RJSCED18BN',
        )).toBe("it(':::RJSCED18BN_test_1:::loads rentals:::5:::', () => {});");
    });

    it('forces the draft to reuse the base test prefix', () => {
        const finalized = finalizeScenarioSpecDraft(
            { baseSolutionCodeFiles: baseFiles, usedTestPrefixes: ['RJSCED22ER'] },
            {
                scenarioName: 'equipment-rental',
                outputFolderBaseName: 'EquipmentRental',
                testPrefix: 'RJSCED22ER',
                textReplacements: [],
                fileRenames: [],
                colorSwaps: [],
                transformableRelativePaths: [],
                manuallyAuthoredFiles: [{
                    relativePath: 'src/__tests__/Rental.test.jsx',
                    content: "it(':::RJSCED22ER_test_1:::loads rentals:::5:::', () => {});",
                }],
            },
        );

        expect(finalized.testPrefix).toBe('RJSCED18BN');
        expect(finalized.manuallyAuthoredFiles[0]?.content).toContain(':::RJSCED18BN_test_1:::');
    });
});
