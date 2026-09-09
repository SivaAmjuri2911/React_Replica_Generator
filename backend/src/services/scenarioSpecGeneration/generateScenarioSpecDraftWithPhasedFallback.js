import {
    generatePhasedScenarioSpecDraft,
    isOutputTruncationError,
    shouldUsePhasedDraft,
} from './phasedScenarioSpecDraft.js';

/**
 * @typedef {import('./phasedScenarioSpecDraft.js').StructuredDraftInvoker} StructuredDraftInvoker
 */

/**
 * @param {import('./ScenarioSpecGenerationService.js').ScenarioSpecGenerationRequest} request
 * @param {{
 *   logger: import('../../logging/Logger.js').Logger,
 *   providerLabel: string,
 *   requestFullDraft: (request: import('./ScenarioSpecGenerationService.js').ScenarioSpecGenerationRequest) => Promise<import('../../shared/Result.js').Result<import('../../domain/models/ScenarioSpecDraft.js').ScenarioSpecDraft, import('../../domain/errors/GenerationError.js').ConfigurationError>>,
 *   invokeStructured: StructuredDraftInvoker,
 * }} deps
 */
export async function generateScenarioSpecDraftWithPhasedFallback(request, deps) {
    const { logger, providerLabel, requestFullDraft, invokeStructured } = deps;

    if (!shouldUsePhasedDraft(request)) {
        const singleShot = await requestFullDraft(request);
        if (singleShot.ok) {
            return singleShot;
        }
        if (!isOutputTruncationError(singleShot.error)) {
            return singleShot;
        }
        logger.info(`${providerLabel}: single-shot draft truncated — retrying with phased drafting`, {
            fileCount: request.baseSolutionCodeFiles.length,
        });
    }
    else {
        logger.info(`${providerLabel}: large base project — using phased drafting`, {
            fileCount: request.baseSolutionCodeFiles.length,
        });
    }

    return generatePhasedScenarioSpecDraft(request, invokeStructured, logger, providerLabel);
}
