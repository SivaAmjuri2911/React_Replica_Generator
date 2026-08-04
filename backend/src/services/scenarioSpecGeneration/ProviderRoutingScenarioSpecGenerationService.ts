import type { Result } from '../../shared/Result.js';
import { err, ok } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';
import type { ScenarioSpecDraft } from '../../domain/models/ScenarioSpecDraft.js';
import type { LlmProvider } from '../../domain/models/LlmProvider.js';
import type { ScenarioSpecGenerationRequest, ScenarioSpecGenerationService } from './ScenarioSpecGenerationService.js';

const DEFAULT_PROVIDER: LlmProvider = 'anthropic';

/**
 * The single ScenarioSpecGenerationService the rest of the system depends
 * on — dispatches to the concrete per-provider implementation named by
 * `request.provider`. Adding a new provider means adding one entry here and
 * one new class implementing the same interface; nothing else changes.
 */
export class ProviderRoutingScenarioSpecGenerationService implements ScenarioSpecGenerationService {
  private readonly servicesByProvider: Readonly<Record<LlmProvider, ScenarioSpecGenerationService>>;

  constructor(servicesByProvider: Readonly<Record<LlmProvider, ScenarioSpecGenerationService>>) {
    this.servicesByProvider = servicesByProvider;
  }

  async generateDraft(
    request: ScenarioSpecGenerationRequest
  ): Promise<Result<ScenarioSpecDraft, ConfigurationError>> {
    const serviceResult = this.resolveService(request.provider);
    if (!serviceResult.ok) {
      return serviceResult;
    }
    return serviceResult.value.generateDraft(request);
  }

  async reviseDraft(
    request: ScenarioSpecGenerationRequest,
    previousDraft: ScenarioSpecDraft,
    failureSummary: string
  ): Promise<Result<ScenarioSpecDraft, ConfigurationError>> {
    const serviceResult = this.resolveService(request.provider);
    if (!serviceResult.ok) {
      return serviceResult;
    }
    return serviceResult.value.reviseDraft(request, previousDraft, failureSummary);
  }

  private resolveService(provider: LlmProvider | undefined): Result<ScenarioSpecGenerationService, ConfigurationError> {
    const resolvedProvider = provider ?? DEFAULT_PROVIDER;
    const service = this.servicesByProvider[resolvedProvider];
    if (!service) {
      return err(new ConfigurationError(`Unknown LLM provider "${resolvedProvider}"`));
    }
    return ok(service);
  }
}
