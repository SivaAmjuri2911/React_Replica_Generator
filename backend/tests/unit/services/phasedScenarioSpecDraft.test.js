import { describe, expect, it } from 'vitest';
import { ConfigurationError } from '../../../src/domain/errors/GenerationError.js';
import {
    batchManuallyAuthoredRelativePaths,
    chunkItems,
    isOutputTruncationError,
    mergeManualFilesByPath,
    mergePhasedDraft,
    missingManuallyAuthoredPaths,
    shouldUsePhasedDraft,
} from '../../../src/services/scenarioSpecGeneration/phasedScenarioSpecDraft.js';

describe('phasedScenarioSpecDraft', () => {
    it('uses phased drafting for large file counts', () => {
        const files = Array.from({ length: 14 }, (_, index) => ({
            relativePath: `src/file${index}.jsx`,
            contents: 'x',
        }));
        expect(shouldUsePhasedDraft({ baseSolutionCodeFiles: files })).toBe(true);
    });

    it('uses phased drafting for large total source size', () => {
        expect(shouldUsePhasedDraft({
            baseSolutionCodeFiles: [{ relativePath: 'src/App.jsx', contents: 'a'.repeat(50_000) }],
        })).toBe(true);
    });

    it('keeps small projects on single-shot drafting', () => {
        expect(shouldUsePhasedDraft({
            baseSolutionCodeFiles: [{ relativePath: 'src/App.jsx', contents: 'small' }],
        })).toBe(false);
    });

    it('detects output truncation errors', () => {
        const error = new ConfigurationError('The draft was truncated at the 64000-token output cap — the base project is too large for one request');
        expect(isOutputTruncationError(error)).toBe(true);
    });

    it('chunks manual file paths into batches', () => {
        expect(chunkItems(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
    });

    it('isolates each test file in its own batch after non-test chunks', () => {
        expect(batchManuallyAuthoredRelativePaths([
            'src/App.jsx',
            'src/components/CourseCard/index.jsx',
            'src/__tests__/Main.test.jsx',
            'readme.md',
        ], 3)).toEqual([
            ['src/App.jsx', 'src/components/CourseCard/index.jsx', 'readme.md'],
            ['src/__tests__/Main.test.jsx'],
        ]);
    });

    it('merges manual files by path so retries can replace omitted files', () => {
        const merged = mergeManualFilesByPath(
            [{ relativePath: 'src/App.jsx', content: 'old app' }],
            [
                { relativePath: 'src/App.jsx', content: 'new app' },
                { relativePath: 'src/__tests__/Main.test.jsx', content: 'tests' },
            ],
        );
        expect(merged).toHaveLength(2);
        expect(merged.find((file) => file.relativePath === 'src/App.jsx')?.content).toBe('new app');
    });

    it('reports manually-authored paths still missing after a batch', () => {
        expect(missingManuallyAuthoredPaths(
            [{ relativePath: 'src/App.jsx', content: 'app' }],
            ['src/App.jsx', 'src/__tests__/Main.test.jsx'],
        )).toEqual(['src/__tests__/Main.test.jsx']);
    });

    it('merges structure and manual files into a full draft', () => {
        const merged = mergePhasedDraft({
            scenarioName: 'ticket-management',
            outputFolderBaseName: 'TicketManagement',
            testPrefix: 'ticket',
            textReplacements: [{ from: 'Bid', to: 'Ticket' }],
            fileRenames: [],
            colorSwaps: [],
            transformableRelativePaths: ['src/App.jsx'],
            manuallyAuthoredRelativePaths: ['src/__tests__/Main.test.jsx'],
        }, [{ relativePath: 'src/__tests__/Main.test.jsx', content: 'test content' }]);

        expect(merged.scenarioName).toBe('ticket-management');
        expect(merged.manuallyAuthoredFiles).toHaveLength(1);
    });
});
