import type { Result } from '../../shared/Result.js';
import type { ConfigurationError } from '../../domain/errors/GenerationError.js';
import type { ModelSummary } from '../../domain/models/ModelSummary.js';

/** Lists the Claude models a given API key can call, so the UI can offer a real, live choice instead of a guessed/hardcoded list. */
export interface ModelCatalogService {
  listModels(apiKey: string): Promise<Result<readonly ModelSummary[], ConfigurationError>>;
}
