import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { LlmProvider, ModelSummary } from '../types.js';

export interface AnalyzeFormValues {
  readonly provider: LlmProvider;
  readonly apiKey: string;
  readonly modelId: string;
  readonly prefilledCodeZip: File;
  readonly solutionCodeZip: File;
}

interface AnalyzeFormProps {
  readonly submitting: boolean;
  readonly models: readonly ModelSummary[];
  readonly modelsLoading: boolean;
  readonly modelsError: string | undefined;
  readonly onFetchModels: (provider: LlmProvider, apiKey: string) => void;
  readonly onProviderChange: () => void;
  readonly onSubmit: (values: AnalyzeFormValues) => void;
}

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
};

const PREFERRED_DEFAULT_MODEL_ID: Record<LlmProvider, string> = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-4o',
  openrouter: 'anthropic/claude-opus-5',
};

const API_KEY_PLACEHOLDER: Record<LlmProvider, string> = {
  anthropic: 'sk-ant-...',
  openai: 'sk-...',
  openrouter: 'sk-or-...',
};

/** How long to wait after the key stops changing before fetching its model list. */
const FETCH_MODELS_DEBOUNCE_MS = 600;

interface ModelGroup {
  readonly vendor: string;
  readonly models: readonly ModelSummary[];
}

const OTHER_VENDOR_LABEL = 'Other';

/**
 * Anthropic/OpenAI only ever return their own models, so those stay one
 * flat, alphabetized list. OpenRouter routes to 50+ vendors in one huge
 * list with no guaranteed order — grouping by the vendor prefix in each
 * model id (e.g. "anthropic/claude-opus-5" -> "anthropic") turns that into
 * something scannable, and sorting everything deterministically (instead of
 * trusting API response order) is also what fixes the default selection
 * appearing to jump to a different model on every fetch.
 */
function groupModelsByVendor(models: readonly ModelSummary[], provider: LlmProvider): readonly ModelGroup[] {
  const byDisplayName = (a: ModelSummary, b: ModelSummary): number => a.displayName.localeCompare(b.displayName);

  if (provider !== 'openrouter') {
    const sorted = [...models].sort(byDisplayName);
    return sorted.length > 0 ? [{ vendor: PROVIDER_LABELS[provider], models: sorted }] : [];
  }

  const modelsByVendor = new Map<string, ModelSummary[]>();
  for (const model of models) {
    const vendor = model.id.includes('/') ? model.id.split('/')[0]! : OTHER_VENDOR_LABEL;
    const group = modelsByVendor.get(vendor);
    if (group) {
      group.push(model);
    } else {
      modelsByVendor.set(vendor, [model]);
    }
  }

  return [...modelsByVendor.entries()]
    .sort(([vendorA], [vendorB]) => vendorA.localeCompare(vendorB))
    .map(([vendor, vendorModels]) => ({ vendor, models: [...vendorModels].sort(byDisplayName) }));
}

/**
 * Uploads a base project (prefilled_code + solution_code only — testcase is
 * a fixed server-side template, see InMemoryAnalysisJobService) and an API
 * key for the chosen provider, so a project this tool has never generated
 * from before doesn't need a hand-authored spec.json. There's no scenario
 * description field — the model reads the uploaded project itself and
 * invents an appropriate new domain (see scenarioSpecDraftContract.ts, rule
 * 10), and the scenario/output folder naming is likewise fully derived from
 * its answer. Pasting or typing a key auto-loads that provider's available
 * models — no explicit "load" action needed.
 */
export function AnalyzeForm({
  submitting,
  models,
  modelsLoading,
  modelsError,
  onFetchModels,
  onProviderChange,
  onSubmit,
}: AnalyzeFormProps): JSX.Element {
  const [provider, setProvider] = useState<LlmProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  const [prefilledCodeZip, setPrefilledCodeZip] = useState<File | undefined>(undefined);
  const [solutionCodeZip, setSolutionCodeZip] = useState<File | undefined>(undefined);

  useEffect(() => {
    const trimmedKey = apiKey.trim();
    if (trimmedKey.length === 0) {
      return;
    }
    const timeoutId = setTimeout(() => {
      onFetchModels(provider, trimmedKey);
    }, FETCH_MODELS_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [apiKey, provider, onFetchModels]);

  const groupedModels = useMemo(() => groupModelsByVendor(models, provider), [models, provider]);

  useEffect(() => {
    if (models.length === 0) {
      return;
    }
    if (models.some((model) => model.id === modelId)) {
      return;
    }
    const preferred = models.find((model) => model.id === PREFERRED_DEFAULT_MODEL_ID[provider]);
    // Same deterministic order the dropdown renders, not raw API response order — so the
    // default pick is stable across fetches instead of tracking whatever order the API
    // happened to return that time.
    const fallback = groupedModels[0]?.models[0];
    if (preferred) {
      setModelId(preferred.id);
    } else if (fallback) {
      setModelId(fallback.id);
    }
  }, [models, groupedModels, modelId, provider]);

  const handleProviderChange = (nextProvider: LlmProvider): void => {
    setProvider(nextProvider);
    setModelId('');
    onProviderChange();
  };

  const canSubmit =
    !submitting &&
    apiKey.trim().length > 0 &&
    modelId.length > 0 &&
    prefilledCodeZip &&
    solutionCodeZip;

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (!canSubmit || !prefilledCodeZip || !solutionCodeZip) {
      return;
    }
    onSubmit({ provider, apiKey, modelId, prefilledCodeZip, solutionCodeZip });
  };

  return (
    <form className="analyze-form" onSubmit={handleSubmit}>
      <label>
        Provider
        <div className="analyze-form-provider">
          {(Object.keys(PROVIDER_LABELS) as LlmProvider[]).map((candidate) => (
            <label key={candidate} className="analyze-form-radio">
              <input
                type="radio"
                name="provider"
                value={candidate}
                checked={provider === candidate}
                onChange={() => handleProviderChange(candidate)}
                disabled={submitting}
              />
              {PROVIDER_LABELS[candidate]}
            </label>
          ))}
        </div>
      </label>

      <label>
        {PROVIDER_LABELS[provider]} API key
        <input
          type="password"
          placeholder={API_KEY_PLACEHOLDER[provider]}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          disabled={submitting}
        />
      </label>

      {modelsLoading && <p className="muted">Loading available models…</p>}
      {modelsError && <p className="error-text">{modelsError}</p>}

      <label>
        Model
        <select
          value={modelId}
          onChange={(event) => setModelId(event.target.value)}
          disabled={submitting || groupedModels.length === 0}
        >
          {groupedModels.length === 0 ? (
            <option value="">Paste a key to load models</option>
          ) : (
            groupedModels.map((group) => (
              <optgroup key={group.vendor} label={group.vendor}>
                {group.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </optgroup>
            ))
          )}
        </select>
      </label>

      <div className="analyze-form-uploads">
        <label>
          prefilled_code.zip
          <input
            type="file"
            accept=".zip"
            onChange={(event) => setPrefilledCodeZip(event.target.files?.[0])}
            disabled={submitting}
          />
        </label>
        <label>
          solution_code.zip
          <input
            type="file"
            accept=".zip"
            onChange={(event) => setSolutionCodeZip(event.target.files?.[0])}
            disabled={submitting}
          />
        </label>
      </div>
      <p className="muted">
        testcase isn't uploaded — the server uses its configured default testcase folder for every
        scenario (only the promoted test file and package.json's name ever change there).
      </p>

      <button type="submit" disabled={!canSubmit}>
        {submitting ? 'Designing your scenario…' : 'Design My Scenario'}
      </button>
    </form>
  );
}
