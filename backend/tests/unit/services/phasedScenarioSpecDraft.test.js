import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { ConfigurationError, RuleViolationError } from '../../../src/domain/errors/GenerationError.js';
import {
    batchManuallyAuthoredRelativePaths,
    chunkItems,
    isOutputTruncationError,
    mergeManualFilesByPath,
    mergePhasedDraft,
    missingManuallyAuthoredPaths,
    shouldUsePhasedDraft,
} from '../../../src/services/scenarioSpecGeneration/phasedScenarioSpecDraft.js';
import { requestOpenAiStructuredDraft } from '../../../src/services/scenarioSpecGeneration/openAiStructuredDraftRequest.js';
import { streamChatCompletion } from '../../../src/services/scenarioSpecGeneration/streamChatCompletion.js';
import { EnforceRulesStep } from '../../../src/pipeline/steps/EnforceRulesStep.js';
import { err } from '../../../src/shared/Result.js';

vi.mock('../../../src/services/scenarioSpecGeneration/streamChatCompletion.js', () => ({
    streamChatCompletion: vi.fn(),
}));

describe('phasedScenarioSpecDraft', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('retries without response_format when a provider rejects structured output', async () => {
        vi.mocked(streamChatCompletion)
            .mockRejectedValueOnce(new Error('OpenRouter rejected response_format: this model does not support json schema'))
            .mockResolvedValueOnce({
                content: JSON.stringify({ ok: true }),
                refusal: '',
                finishReason: undefined,
                maxCompletionTokensUsed: undefined,
                wasReducedForAffordability: false,
            });

        const result = await requestOpenAiStructuredDraft({
            client: {},
            logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
            modelId: 'openrouter/test-model',
            systemPrompt: 'sys',
            userPrompt: 'user',
            schema: z.object({ ok: z.boolean() }),
            schemaName: 'test_schema',
            providerLabel: 'OpenRouter',
            phaseLabel: 'manual-files-1',
            allowJsonRecovery: true,
        });

        expect(result.ok).toBe(true);
        expect(vi.mocked(streamChatCompletion)).toHaveBeenCalledTimes(2);
        expect(vi.mocked(streamChatCompletion).mock.calls[0][1].response_format).toBeDefined();
        expect(vi.mocked(streamChatCompletion).mock.calls[1][1].response_format).toBeUndefined();
    });

    it('preserves the underlying provider error when structured retries also fail', async () => {
        vi.mocked(streamChatCompletion)
            .mockRejectedValueOnce(new Error('OpenRouter rejected response_format: this model does not support json schema'))
            .mockRejectedValueOnce(new Error('fallback request also failed'));

        const result = await requestOpenAiStructuredDraft({
            client: {},
            logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
            modelId: 'openrouter/test-model',
            systemPrompt: 'sys',
            userPrompt: 'user',
            schema: z.object({ ok: z.boolean() }),
            schemaName: 'test_schema',
            providerLabel: 'OpenRouter',
            phaseLabel: 'manual-files-1',
            allowJsonRecovery: true,
        });

        expect(result.ok).toBe(false);
        expect(result.error.message).toContain('fallback request also failed');
    });

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

    it('preserves rule violation details in the thrown error context', async () => {
        const rulesRegistry = {
            evaluateAll: async () => err([
                new RuleViolationError('PackageJsonAlignmentRule', 'Package names do not match'),
            ]),
        };

        const step = new EnforceRulesStep(rulesRegistry, {});

        await expect(step.execute({
            spec: { scenarioName: 'demo' },
            prefilledCodePath: 'prefilled',
            solutionCodePath: 'solution',
            testcasePath: 'testcase',
            ideBasedCodingJsonPath: 'ide-based-coding.json',
            testCases: [],
            questionId: 'question',
            ideSessionId: 'session',
        })).rejects.toMatchObject({
            context: {
                violations: [expect.objectContaining({ ruleName: 'PackageJsonAlignmentRule' })],
            },
        });
    });
});
