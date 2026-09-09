import { describe, expect, it } from 'vitest';
import { RouteRenameConsistencyRule } from '../../../src/rulesEngine/rules/RouteRenameConsistencyRule.js';
import { InMemoryFileSystemService } from '../fakes/InMemoryFileSystemService.js';
function buildSpec(fileRenames) {
    return {
        scenarioName: 'equipment-rental',
        outputFolderBaseName: 'EquipmentRental',
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
        fileRenames,
        transformableRelativePaths: [],
        colorSwaps: [],
        manuallyAuthoredRelativePaths: [],
    };
}
function buildGeneratedProject() {
    return {
        scenarioName: 'equipment-rental',
        prefilledCodePath: '/out/Prefilled',
        solutionCodePath: '/out/Solution',
        testcasePath: '/out/Testcase',
        ideBasedCodingJsonPath: '/out/json/id.json',
        testCases: [],
        questionId: 'q1',
        ideSessionId: 's1',
    };
}
describe('RouteRenameConsistencyRule', () => {
    const rule = new RouteRenameConsistencyRule();
    const fileRenames = [
        { fromRelativePath: 'src/components/PODPage.jsx', toRelativePath: 'src/components/ItemsPage.jsx' },
        { fromRelativePath: 'src/components/VendorPage.jsx', toRelativePath: 'src/components/ProvidersPage.jsx' },
    ];
    it('fails when a renamed page\'s route path still uses the base scenario\'s original literal', async () => {
        const fileSystem = new InMemoryFileSystemService();
        const generatedProject = buildGeneratedProject();
        // The exact real-world bug: PODPage -> ItemsPage renamed, display text updated,
        // but the route itself left as the base scenario's original "/pod".
        fileSystem.seed(`${generatedProject.solutionCodePath}/src/App.jsx`, '<Route path="/pod" element={<ItemsPage />} />\n<Route path="/providers" element={<ProvidersPage />} />');
        const result = await rule.evaluate({ spec: buildSpec(fileRenames), generatedProject, fileSystem });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('/pod');
        }
    });
    it('passes when every renamed page\'s route was updated to match', async () => {
        const fileSystem = new InMemoryFileSystemService();
        const generatedProject = buildGeneratedProject();
        fileSystem.seed(`${generatedProject.solutionCodePath}/src/App.jsx`, '<Route path="/items" element={<ItemsPage />} />\n<Route path="/providers" element={<ProvidersPage />} />');
        const result = await rule.evaluate({ spec: buildSpec(fileRenames), generatedProject, fileSystem });
        expect(result.ok).toBe(true);
    });
    it('does not false-positive on unrelated text that merely contains the slug as a substring', async () => {
        const fileSystem = new InMemoryFileSystemService();
        const generatedProject = buildGeneratedProject();
        // "podcast" contains "pod" but is not a route literal ("/pod" followed by a boundary) —
        // must not trip the rule.
        fileSystem.seed(`${generatedProject.solutionCodePath}/src/App.jsx`, '<Route path="/items" element={<ItemsPage />} />\nconst podcastName = "tech";');
        const result = await rule.evaluate({ spec: buildSpec(fileRenames), generatedProject, fileSystem });
        expect(result.ok).toBe(true);
    });
    it('passes trivially when the spec has no file renames', async () => {
        const fileSystem = new InMemoryFileSystemService();
        const generatedProject = buildGeneratedProject();
        const result = await rule.evaluate({ spec: buildSpec([]), generatedProject, fileSystem });
        expect(result.ok).toBe(true);
    });
});
