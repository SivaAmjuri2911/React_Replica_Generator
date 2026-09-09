/**
 * Lists the Claude models a given API key can call, so the UI can offer a real, live choice instead of a guessed/hardcoded list.
 * @typedef {object} ModelCatalogService
 * @property {(apiKey: string) => Promise<import('../../shared/Result.js').Result<readonly import('../../domain/models/ModelSummary.js').ModelSummary[], import('../../domain/errors/GenerationError.js').ConfigurationError>>} listModels
 */

export {};
