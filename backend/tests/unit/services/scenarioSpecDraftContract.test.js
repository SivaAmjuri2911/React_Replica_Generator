import { describe, expect, it } from 'vitest';
import {
    buildScenarioSpecDraftUserPrompt,
    SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT,
    SCENARIO_SPEC_MANUAL_FILES_SYSTEM_PROMPT,
    SEED_DATA_IMAGE_URL_RULE,
    TEST_FILE_PRESERVATION_RULE,
} from '../../../src/services/scenarioSpecGeneration/scenarioSpecDraftContract.js';

describe('scenarioSpecDraftContract', () => {
    it('requires fresh Unsplash URLs for regenerated seed-data images', () => {
        expect(SEED_DATA_IMAGE_URL_RULE).toContain('images.unsplash.com');
        expect(SEED_DATA_IMAGE_URL_RULE).toContain('Do NOT reuse image URLs from the base scenario');
        expect(SEED_DATA_IMAGE_URL_RULE).toContain('Never use PLACEHOLDER_* tokens');
    });

    it('embeds the seed-data image rule in both draft system prompts', () => {
        expect(SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT).toContain('SEED-DATA IMAGE URLs');
        expect(SCENARIO_SPEC_MANUAL_FILES_SYSTEM_PROMPT).toContain('SEED-DATA IMAGE URLs');
        expect(SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT).toContain('STATIC UI ASSETS');
    });

    it('requires preserving the base test file structure and prefix', () => {
        expect(TEST_FILE_PRESERVATION_RULE).toContain('start from the base solution_code test file');
        expect(TEST_FILE_PRESERVATION_RULE).toContain('PREFER TRANSFORMABLE');
        expect(SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT).toContain('start from the base solution_code test file');
    });

    it('tells the model to reuse the base test prefix when one exists', () => {
        const prompt = buildScenarioSpecDraftUserPrompt({
            baseSolutionCodeFiles: [{
                relativePath: 'src/__tests__/Main.test.jsx',
                contents: "it(':::RJSCEP7M4A_test_1:::example:::5:::', () => {});",
            }],
            usedTestPrefixes: ['RJSCED18BN'],
        });
        expect(prompt).toContain('REQUIRED testPrefix: "RJSCEP7M4A"');
        expect(prompt).not.toContain('pick a new one');
    });
});
