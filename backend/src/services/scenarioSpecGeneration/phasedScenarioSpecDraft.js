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

export const PHASED_DRAFT_MIN_FILE_COUNT = 14;
export const PHASED_DRAFT_MIN_TOTAL_CHARS = 50_000;
export const MANUAL_FILES_BATCH_SIZE = 3;

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

    const structure = scenarioSpecStructureDraftSchema.parse(structureResult.value);
    logger.info(`${providerLabel}: received phased structure draft`, {
        scenarioName: structure.scenarioName,
        transformableFileCount: structure.transformableRelativePaths.length,
        manuallyAuthoredFileCount: structure.manuallyAuthoredRelativePaths.length,
    });

    /** @type {import('../../domain/models/ScenarioSpecDraft.js').ManuallyAuthoredFileDraft[]} */
    const manualFiles = [];
    const batches = chunkItems(structure.manuallyAuthoredRelativePaths, MANUAL_FILES_BATCH_SIZE);
    for (const [index, batchPaths] of batches.entries()) {
        logger.info(`${providerLabel}: drafting manually-authored file batch`, {
            batch: index + 1,
            batchCount: batches.length,
            paths: batchPaths,
        });
        const batchResult = await invokeStructured({
            systemPrompt: SCENARIO_SPEC_MANUAL_FILES_SYSTEM_PROMPT,
            userPrompt: buildManuallyAuthoredFilesBatchUserPrompt(request, structure, batchPaths),
            schema: manuallyAuthoredFilesBatchSchema,
            schemaName: 'manually_authored_files_batch',
            phaseLabel: `manual-files-${index + 1}`,
        });
        if (!batchResult.ok) {
            return batchResult;
        }
        const batch = manuallyAuthoredFilesBatchSchema.parse(batchResult.value);
        manualFiles.push(...batch.manuallyAuthoredFiles);
    }

    const merged = mergePhasedDraft(structure, manualFiles);
    const missingPaths = structure.manuallyAuthoredRelativePaths.filter((path) => !manualFiles.some((file) => file.relativePath === path));
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
