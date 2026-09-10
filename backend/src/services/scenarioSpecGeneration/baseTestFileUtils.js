const TEST_FILE_PATH_PATTERN = /\.test\.(jsx?|tsx?)$/i;
const TEST_MARKER_PREFIX_PATTERN = /:::([A-Za-z0-9]+)_test_\d+:::/;

/**
 * @param {readonly import('./ScenarioSpecGenerationService.js').BaseSourceFile[]} baseSolutionCodeFiles
 * @returns {string|undefined}
 */
export function extractBaseTestPrefix(baseSolutionCodeFiles) {
    for (const file of baseSolutionCodeFiles) {
        if (!TEST_FILE_PATH_PATTERN.test(file.relativePath)) {
            continue;
        }
        const match = TEST_MARKER_PREFIX_PATTERN.exec(file.contents);
        if (match?.[1]) {
            return match[1];
        }
    }
    return undefined;
}

/** @param {string} relativePath */
export function isTestFileRelativePath(relativePath) {
    return TEST_FILE_PATH_PATTERN.test(relativePath);
}

/**
 * @param {string} content
 * @param {string} prefix
 */
export function rewriteTestMarkersToPrefix(content, prefix) {
    return content.replace(/:::([A-Za-z0-9]+)_test_(\d+):::/g, `:::${prefix}_test_$2:::`);
}

/**
 * Forces the draft to reuse the base solution_code test prefix and fixes
 * any marker prefixes the model invented in manually-authored test files.
 *
 * @param {import('./ScenarioSpecGenerationService.js').ScenarioSpecGenerationRequest} request
 * @param {import('../../domain/models/ScenarioSpecDraft.js').ScenarioSpecDraft} draft
 */
export function finalizeScenarioSpecDraft(request, draft) {
    const baseTestPrefix = extractBaseTestPrefix(request.baseSolutionCodeFiles);
    if (!baseTestPrefix) {
        return draft;
    }
    return {
        ...draft,
        testPrefix: baseTestPrefix,
        manuallyAuthoredFiles: draft.manuallyAuthoredFiles.map((file) => {
            if (!isTestFileRelativePath(file.relativePath)) {
                return file;
            }
            return {
                relativePath: file.relativePath,
                content: rewriteTestMarkersToPrefix(file.content, baseTestPrefix),
            };
        }),
    };
}
