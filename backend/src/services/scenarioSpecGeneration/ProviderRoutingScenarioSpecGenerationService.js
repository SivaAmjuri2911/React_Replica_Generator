import { err, ok } from '../../shared/Result.js';
import { ConfigurationError } from '../../domain/errors/GenerationError.js';
const DEFAULT_PROVIDER = 'anthropic';
/**
 * The single ScenarioSpecGenerationService the rest of the system depends
 * on — dispatches to the concrete per-provider implementation named by
 * `request.provider`. Adding a new provider means adding one entry here and
 * one new class implementing the same interface; nothing else changes.
 */
/**
 * @implements {ScenarioSpecGenerationService}
 */
export class ProviderRoutingScenarioSpecGenerationService {
    servicesByProvider;
    constructor(servicesByProvider) {
        this.servicesByProvider = servicesByProvider;
    }
    async generateDraft(request) {
        const serviceResult = this.resolveService(request.provider);
        if (!serviceResult.ok) {
            return serviceResult;
        }
        return serviceResult.value.generateDraft(request);
    }
    async reviseDraft(request, previousDraft, failureSummary) {
        const serviceResult = this.resolveService(request.provider);
        if (!serviceResult.ok) {
            return serviceResult;
        }
        return serviceResult.value.reviseDraft(request, previousDraft, failureSummary);
    }
    resolveService(provider) {
        const resolvedProvider = provider ?? DEFAULT_PROVIDER;
        const service = this.servicesByProvider[resolvedProvider];
        if (!service) {
            return err(new ConfigurationError(`Unknown LLM provider "${resolvedProvider}"`));
        }
        return ok(service);
    }
}
