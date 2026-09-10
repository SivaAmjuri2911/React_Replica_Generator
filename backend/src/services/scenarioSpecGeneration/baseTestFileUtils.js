const TEST_FILE_PATH_PATTERN = /\.test\.(jsx?|tsx?)$/i;
/** Matches both legacy `:::PREFIX_TEST_N:::` and canonical `:::PREFIX_test_N:::`. */
const TEST_MARKER_PATTERN = /:::([A-Za-z0-9]+)_test_(\d+):::/gi;

/**
 * @param {readonly import('./ScenarioSpecGenerationService.js').BaseSourceFile[]} baseSolutionCodeFiles
 * @returns {string|undefined}
 */
export function extractBaseTestPrefix(baseSolutionCodeFiles) {
    for (const file of baseSolutionCodeFiles) {
        if (!TEST_FILE_PATH_PATTERN.test(file.relativePath)) {
            continue;
        }
        TEST_MARKER_PATTERN.lastIndex = 0;
        const match = TEST_MARKER_PATTERN.exec(file.contents);
        if (match?.[1]) {
            return match[1];
        }
    }
    return undefined;
}

/**
 * @param {readonly import('./ScenarioSpecGenerationService.js').BaseSourceFile[]} baseSolutionCodeFiles
 * @returns {string[]}
 */
export function listBaseTestFileRelativePaths(baseSolutionCodeFiles) {
    return baseSolutionCodeFiles
        .filter((file) => TEST_FILE_PATH_PATTERN.test(file.relativePath))
        .map((file) => file.relativePath);
}

/** @param {string} relativePath */
export function isTestFileRelativePath(relativePath) {
    return TEST_FILE_PATH_PATTERN.test(relativePath);
}

/**
 * @param {string} relativePath
 * @param {readonly import('../../domain/models/TextReplacement.js').FileRename[]} fileRenames
 */
export function resolvePostRenameRelativePath(relativePath, fileRenames) {
    const rename = fileRenames.find((entry) => entry.fromRelativePath === relativePath);
    return rename ? rename.toRelativePath : relativePath;
}

/**
 * Canonicalize marker casing/prefix so DeriveTestCasesStep always sees `:::PREFIX_test_N:::`
 * even when the base solution used legacy `:::PREFIX_TEST_N:::`. Numbering is preserved.
 *
 * @param {string} content
 * @param {string|undefined} prefix When set, every marker uses this prefix.
 */
export function normalizeTestFileMarkers(content, prefix) {
    return content.replace(TEST_MARKER_PATTERN, (_match, foundPrefix, testNumber) => {
        const canonicalPrefix = prefix ?? foundPrefix;
        return `:::${canonicalPrefix}_test_${testNumber}:::`;
    });
}

/**
 * @param {readonly string[]} paths
 * @param {readonly string[]} extraPaths
 */
function mergeUniqueRelativePaths(paths, extraPaths) {
    return [...new Set([...paths, ...extraPaths])];
}

/**
 * Phase-1 structure draft — test files are never AI-authored; they stay on the
 * mechanical transformable path from the base solution_code test file.
 *
 * @param {import('./ScenarioSpecGenerationService.js').ScenarioSpecGenerationRequest} request
 * @param {import('zod').infer<typeof import('./scenarioSpecDraftContract.js').scenarioSpecStructureDraftSchema>} structure
 */
export function enforceDeterministicTestFilesOnStructure(request, structure) {
    const baseTestPrefix = extractBaseTestPrefix(request.baseSolutionCodeFiles);
    const baseTestPaths = listBaseTestFileRelativePaths(request.baseSolutionCodeFiles);
    if (baseTestPaths.length === 0) {
        return structure;
    }
    const transformedTestPaths = baseTestPaths.map((relativePath) => resolvePostRenameRelativePath(relativePath, structure.fileRenames));
    return {
        ...structure,
        testPrefix: baseTestPrefix ?? structure.testPrefix,
        transformableRelativePaths: mergeUniqueRelativePaths(structure.transformableRelativePaths, transformedTestPaths),
        manuallyAuthoredRelativePaths: structure.manuallyAuthoredRelativePaths.filter((relativePath) => !isTestFileRelativePath(relativePath)),
    };
}

/**
 * Full draft — strip any AI-authored test file content and force transformable handling.
 *
 * @param {import('./ScenarioSpecGenerationService.js').ScenarioSpecGenerationRequest} request
 * @param {import('../../domain/models/ScenarioSpecDraft.js').ScenarioSpecDraft} draft
 */
export function finalizeScenarioSpecDraft(request, draft) {
    const baseTestPrefix = extractBaseTestPrefix(request.baseSolutionCodeFiles);
    const baseTestPaths = listBaseTestFileRelativePaths(request.baseSolutionCodeFiles);
    if (baseTestPaths.length === 0) {
        return draft;
    }
    const transformedTestPaths = baseTestPaths.map((relativePath) => resolvePostRenameRelativePath(relativePath, draft.fileRenames));
    return {
        ...draft,
        testPrefix: baseTestPrefix ?? draft.testPrefix,
        transformableRelativePaths: mergeUniqueRelativePaths(draft.transformableRelativePaths, transformedTestPaths),
        manuallyAuthoredFiles: draft.manuallyAuthoredFiles.filter((file) => !isTestFileRelativePath(file.relativePath)),
    };
}
