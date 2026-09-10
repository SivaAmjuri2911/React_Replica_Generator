import { err, ok } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';
import {
    buildManuallyAuthoredFilesBatchUserPrompt,
    buildScenarioSpecStructureUserPrompt,
    manuallyAuthoredFilesBatchSchema,
    SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT,
    SCENARIO_SPEC_MANUAL_FILES_SYSTEM_PROMPT,
    SCENARIO_SPEC_STRUCTURE_PHASE_NOTE,
    scenarioSpecDraftSchema,
    scenarioSpecStructureDraftSchema,
} from './scenarioSpecDraftContract.js';
import { enforceDeterministicTestFilesOnStructure } from './baseTestFileUtils.js';

export const PHASED_DRAFT_MIN_FILE_COUNT = 14;
export const PHASED_DRAFT_MIN_TOTAL_CHARS = 50_000;
export const MANUAL_FILES_BATCH_SIZE = 3;
export const MAX_MISSING_MANUAL_FILE_RETRIES = 2;
const TEST_FILE_PATH_PATTERN = /\.test\.(jsx?|tsx?)$/i;

/** @param {import('./ScenarioSpecGenerationService.js').ScenarioSpecGenerationRequest} request */
export function shouldUsePhasedDraft(request) {
    const fileCount = request.baseSolutionCodeFiles.length;
    const totalChars = request.baseSolutionCodeFiles.reduce((sum, file) => sum + file.contents.length, 0);
    return fileCount >= PHASED_DRAFT_MIN_FILE_COUNT || totalChars >= PHASED_DRAFT_MIN_TOTAL_CHARS;
}

/** @param {import('../../domain/errors/GenerationError.js').ConfigurationError} error */
export function isOutputTruncationError(error) {
    return error.message.includes('truncated at the') && error.message.includes('output cap');
}

/**
 * @template T
 * @param {readonly T[]} items
 * @param {number} batchSize
 * @returns {T[][]}
 */
export function chunkItems(items, batchSize) {
    /** @type {T[][]} */
    const batches = [];
    for (let index = 0; index < items.length; index += batchSize) {
        batches.push(items.slice(index, index + batchSize));
    }
    return batches;
}

/**
 * Test files are drafted alone — bundling a *.test.jsx with App.jsx in the same
 * batch caused OpenRouter to return the smaller files but drop the test file
 * (course-marketplace, analysis-d1892c1e). Non-test paths keep the normal batch size.
 *
 * @param {readonly string[]} paths
 * @param {number} [batchSize]
 * @returns {string[][]}
 */
export function batchManuallyAuthoredRelativePaths(paths, batchSize = MANUAL_FILES_BATCH_SIZE) {
    /** @type {string[]} */
    const testPaths = [];
    /** @type {string[]} */
    const otherPaths = [];
    for (const relativePath of paths) {
        if (TEST_FILE_PATH_PATTERN.test(relativePath)) {
            testPaths.push(relativePath);
        }
        else {
            otherPaths.push(relativePath);
        }
    }
    /** @type {string[][]} */
    const batches = chunkItems(otherPaths, batchSize);
    for (const testPath of testPaths) {
        batches.push([testPath]);
    }
    return batches;
}

/**
 * @param {readonly import('../../domain/models/ScenarioSpecDraft.js').ManuallyAuthoredFileDraft[]} existing
 * @param {readonly import('../../domain/models/ScenarioSpecDraft.js').ManuallyAuthoredFileDraft[]} incoming
 */
export function mergeManualFilesByPath(existing, incoming) {
    const byPath = new Map(existing.map((file) => [file.relativePath, file]));
    for (const file of incoming) {
        byPath.set(file.relativePath, file);
    }
    return [...byPath.values()];
}

/** @param {readonly import('../../domain/models/ScenarioSpecDraft.js').ManuallyAuthoredFileDraft[]} manualFiles @param {readonly string[]} expectedPaths */
export function missingManuallyAuthoredPaths(manualFiles, expectedPaths) {
    return expectedPaths.filter((relativePath) => !manualFiles.some((file) => file.relativePath === relativePath));
}

/**
 * @param {import('zod').infer<typeof scenarioSpecStructureDraftSchema>} structure
 * @param {readonly import('../../domain/models/ScenarioSpecDraft.js').ManuallyAuthoredFileDraft[]} manualFiles
 */
export function mergePhasedDraft(structure, manualFiles) {
    return {
        scenarioName: structure.scenarioName,
        outputFolderBaseName: structure.outputFolderBaseName,
        testPrefix: structure.testPrefix,
        textReplacements: structure.textReplacements,
        fileRenames: structure.fileRenames,
        colorSwaps: structure.colorSwaps,
        transformableRelativePaths: structure.transformableRelativePaths,
        manuallyAuthoredFiles: manualFiles,
    };
}

/**
 * @typedef {object} StructuredDraftRequest
 * @property {string} systemPrompt
 * @property {string} userPrompt
 * @property {import('zod').ZodTypeAny} schema
 * @property {string} schemaName
 * @property {string} phaseLabel
 */

/**
 * @typedef {(request: StructuredDraftRequest) => Promise<import('../../shared/Result.js').Result<unknown, ConfigurationError>>} StructuredDraftInvoker
 */

/**
 * @param {import('./ScenarioSpecGenerationService.js').ScenarioSpecGenerationRequest} request
 * @param {StructuredDraftInvoker} invokeStructured
 * @param {import('../../logging/Logger.js').Logger} logger
 * @param {string} providerLabel
 */
export async function generatePhasedScenarioSpecDraft(request, invokeStructured, logger, providerLabel) {
    logger.info(`${providerLabel}: starting phased scenario spec draft`, {
        fileCount: request.baseSolutionCodeFiles.length,
        batchSize: MANUAL_FILES_BATCH_SIZE,
    });

    const structureResult = await invokeStructured({
        systemPrompt: `${SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT}\n\n${SCENARIO_SPEC_STRUCTURE_PHASE_NOTE}`,
        userPrompt: buildScenarioSpecStructureUserPrompt(request),
        schema: scenarioSpecStructureDraftSchema,
        schemaName: 'scenario_spec_structure_draft',
        phaseLabel: 'structure',
    });
    if (!structureResult.ok) {
        return structureResult;
    }

    let structure = enforceDeterministicTestFilesOnStructure(
        request,
        scenarioSpecStructureDraftSchema.parse(structureResult.value),
    );
    logger.info(`${providerLabel}: received phased structure draft`, {
        scenarioName: structure.scenarioName,
        transformableFileCount: structure.transformableRelativePaths.length,
        manuallyAuthoredFileCount: structure.manuallyAuthoredRelativePaths.length,
    });

    /** @type {import('../../domain/models/ScenarioSpecDraft.js').ManuallyAuthoredFileDraft[]} */
    let manualFiles = [];
    const batches = batchManuallyAuthoredRelativePaths(structure.manuallyAuthoredRelativePaths, MANUAL_FILES_BATCH_SIZE);

    /**
     * @param {readonly string[]} batchPaths
     * @param {number} batchNumber
     * @param {number} batchCount
     * @param {string} phaseLabel
     */
    const draftManualFileBatch = async (batchPaths, batchNumber, batchCount, phaseLabel) => {
        logger.info(`${providerLabel}: drafting manually-authored file batch`, {
            batch: batchNumber,
            batchCount,
            paths: batchPaths,
        });
        const batchResult = await invokeStructured({
            systemPrompt: SCENARIO_SPEC_MANUAL_FILES_SYSTEM_PROMPT,
            userPrompt: buildManuallyAuthoredFilesBatchUserPrompt(request, structure, batchPaths),
            schema: manuallyAuthoredFilesBatchSchema,
            schemaName: 'manually_authored_files_batch',
            phaseLabel,
        });
        if (!batchResult.ok) {
            return batchResult;
        }
        const batch = manuallyAuthoredFilesBatchSchema.parse(batchResult.value);
        manualFiles = mergeManualFilesByPath(manualFiles, batch.manuallyAuthoredFiles);
        return ok(undefined);
    };

    for (const [index, batchPaths] of batches.entries()) {
        const batchResult = await draftManualFileBatch(batchPaths, index + 1, batches.length, `manual-files-${index + 1}`);
        if (!batchResult.ok) {
            return batchResult;
        }
    }

    let missingPaths = missingManuallyAuthoredPaths(manualFiles, structure.manuallyAuthoredRelativePaths);
    for (let retryRound = 1; missingPaths.length > 0 && retryRound <= MAX_MISSING_MANUAL_FILE_RETRIES; retryRound++) {
        logger.warn(`${providerLabel}: retrying manually-authored files the model omitted`, {
            missingPaths,
            retryRound,
            maxRetries: MAX_MISSING_MANUAL_FILE_RETRIES,
        });
        const retryBatches = batchManuallyAuthoredRelativePaths(missingPaths, 1);
        for (const [index, batchPaths] of retryBatches.entries()) {
            const batchResult = await draftManualFileBatch(batchPaths, index + 1, retryBatches.length, `manual-files-retry-${retryRound}-${index + 1}`);
            if (!batchResult.ok) {
                return batchResult;
            }
        }
        missingPaths = missingManuallyAuthoredPaths(manualFiles, structure.manuallyAuthoredRelativePaths);
    }

    const merged = mergePhasedDraft(structure, manualFiles);
    if (missingPaths.length > 0) {
        return err(new ConfigurationError('Phased drafting did not produce content for every manually-authored file', {
            missingPaths,
        }));
    }

    const validation = scenarioSpecDraftSchema.safeParse(merged);
    if (!validation.success) {
        return err(new ConfigurationError('Merged phased draft did not match the required schema', {
            issues: validation.error.issues,
        }));
    }

    logger.info(`${providerLabel}: completed phased scenario spec draft`, {
        scenarioName: validation.data.scenarioName,
        transformableFileCount: validation.data.transformableRelativePaths.length,
        manuallyAuthoredFileCount: validation.data.manuallyAuthoredFiles.length,
        batchCount: batches.length,
    });
    return ok(validation.data);
}
