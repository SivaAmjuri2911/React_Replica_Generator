import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * @typedef {object} AnalyzeFormValues
 * @property {import('../types.js').LlmProvider} provider
 * @property {string} apiKey
 * @property {string} modelId
 * @property {File} prefilledCodeZip
 * @property {File} solutionCodeZip
 */

/**
 * @typedef {object} AnalyzeFormProps
 * @property {boolean} submitting
 * @property {readonly import('../types.js').ModelSummary[]} models
 * @property {boolean} modelsLoading
 * @property {string|undefined} modelsError
 * @property {(provider: import('../types.js').LlmProvider, apiKey: string) => void} onFetchModels
 * @property {() => void} onProviderChange
 * @property {(values: AnalyzeFormValues) => void} onSubmit
 */

const PROVIDER_LABELS = {
    anthropic: 'Anthropic (Claude)',
    openai: 'OpenAI',
    openrouter: 'OpenRouter',
    mistral: 'Mistral AI',
};
const PREFERRED_DEFAULT_MODEL_ID = {
    anthropic: 'claude-opus-5',
    openai: 'gpt-4o',
    openrouter: 'anthropic/claude-opus-5',
    mistral: 'mistral-large-latest',
};
const API_KEY_PLACEHOLDER = {
    anthropic: 'sk-ant-...',
    openai: 'sk-...',
    openrouter: 'sk-or-...',
    mistral: '32-character key from console.mistral.ai',
};
/** Mistral Studio keys are 32 alphanumeric characters with no prefix. */
const MISTRAL_API_KEY_PATTERN = /^[A-Za-z0-9]{32}$/;
/** How long to wait after the key stops changing before fetching its model list. */
const FETCH_MODELS_DEBOUNCE_MS = 600;
/**
 * Anthropic keys start "sk-ant-" and OpenRouter keys start "sk-or-" — both are more specific
 * prefixes of OpenAI's plain "sk-", so they must be checked first or every key would misdetect
 * as OpenAI. A key format that matches none of these (a custom/enterprise key, say) returns
 * undefined and leaves whatever provider is already selected alone.
 */
function detectProviderFromApiKey(apiKey) {
    if (apiKey.startsWith('sk-ant-')) {
        return 'anthropic';
    }
    if (apiKey.startsWith('sk-or-')) {
        return 'openrouter';
    }
    if (apiKey.startsWith('sk-')) {
        return 'openai';
    }
    if (MISTRAL_API_KEY_PATTERN.test(apiKey)) {
        return 'mistral';
    }
    return undefined;
}
/**
 * @typedef {object} ModelGroup
 * @property {string} vendor
 * @property {readonly import('../types.js').ModelSummary[]} models
 */

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
function groupModelsByVendor(models, provider) {
    const byDisplayName = (a, b) => a.displayName.localeCompare(b.displayName);
    if (provider !== 'openrouter') {
        const sorted = [...models].sort(byDisplayName);
        return sorted.length > 0 ? [{ vendor: PROVIDER_LABELS[provider], models: sorted }] : [];
    }
    const modelsByVendor = new Map();
    for (const model of models) {
        const vendor = model.id.includes('/') ? model.id.split('/')[0] : OTHER_VENDOR_LABEL;
        const group = modelsByVendor.get(vendor);
        if (group) {
            group.push(model);
        }
        else {
            modelsByVendor.set(vendor, [model]);
        }
    }
    return [...modelsByVendor.entries()]
        .sort(([vendorA], [vendorB]) => vendorA.localeCompare(vendorB))
        .map(([vendor, vendorModels]) => ({ vendor, models: [...vendorModels].sort(byDisplayName) }));
}

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/* Icons (inline SVG, no icon-library dependency)                     */
/* ------------------------------------------------------------------ */

function IconSparkle(props) {
    return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M8 1Q9.5 6.5 15 8Q9.5 9.5 8 15Q6.5 9.5 1 8Q6.5 6.5 8 1Z" fill="currentColor"/>
    </svg>);
}
function IconOpenAiMark(props) {
    return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M8 2.2C9 2.2 9.9 2.7 10.4 3.6C11.4 3.4 12.4 3.8 13 4.6C13.6 5.4 13.7 6.5 13.3 7.4C14 8 14.3 9 14 9.9C13.8 10.9 13 11.6 12 11.8C11.8 12.8 11 13.6 10 13.8C9 14 8 13.6 7.4 12.8C6.4 13 5.4 12.6 4.8 11.8C4.2 11 4.1 9.9 4.5 9C3.8 8.4 3.5 7.4 3.8 6.5C4 5.5 4.8 4.8 5.8 4.6C6 3.6 6.8 2.8 7.8 2.6C7.9 2.3 7.9 2.2 8 2.2Z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round"/>
      <circle cx="8" cy="8" r="1.6" fill="currentColor"/>
    </svg>);
}
function IconOpenRouterMark(props) {
    return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M1.5 8H8.5M8.5 8L5.5 5M8.5 8L5.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.5 8H7.5M7.5 8L10.5 5M7.5 8L10.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.55"/>
    </svg>);
}
function IconMistralMark(props) {
    return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M2 12L5 4L8 10L11 4L14 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
}
const PROVIDER_ICONS = {
    anthropic: IconSparkle,
    openai: IconOpenAiMark,
    openrouter: IconOpenRouterMark,
    mistral: IconMistralMark,
};
const PROVIDER_ICON_CLASS = {
    anthropic: 'provider-card-icon-anthropic',
    openai: 'provider-card-icon-openai',
    openrouter: 'provider-card-icon-openrouter',
    mistral: 'provider-card-icon-mistral',
};
function IconCube(props) {
    return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M8 1.5L14 4.8V11.2L8 14.5L2 11.2V4.8L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M2 4.8L8 8.1M8 8.1L14 4.8M8 8.1V14.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>);
}
function IconRocket(props) {
    return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M8 1.5C9.8 3 10.8 5.4 10.8 8C10.8 9 10.6 9.9 10.3 10.7L8 12.5L5.7 10.7C5.4 9.9 5.2 9 5.2 8C5.2 5.4 6.2 3 8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <circle cx="8" cy="6.8" r="1.2" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M5.4 9.8L3.5 10.8C3.3 11.6 3.2 12.9 3.4 14.5C4.9 14.6 6.1 14.2 6.8 13.8L7 11.6M10.6 9.8L12.5 10.8C12.7 11.6 12.8 12.9 12.6 14.5C11.1 14.6 9.9 14.2 9.2 13.8L9 11.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
}
function IconX(props) {
    return (<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>);
}
function IconKey(props) {
    return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="5.2" cy="10.8" r="2.7" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7.1 8.9L12.8 3.2M12.8 3.2H10.4M12.8 3.2V5.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
}
function IconEye(props) {
    return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M1 8C1 8 3.5 3.5 8 3.5C12.5 3.5 15 8 15 8C15 8 12.5 12.5 8 12.5C3.5 12.5 1 8 1 8Z" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>);
}
function IconEyeOff(props) {
    return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M2 2L14 14M6.3 6.4C5.9 6.8 5.7 7.4 5.7 8C5.7 9.3 6.7 10.3 8 10.3C8.6 10.3 9.2 10.1 9.6 9.7M4.1 4.3C2.4 5.4 1 8 1 8C1 8 3.5 12.5 8 12.5C9.4 12.5 10.5 12.1 11.5 11.4M13 10C14.3 8.9 15 8 15 8C15 8 12.5 3.5 8 3.5C7.6 3.5 7.2 3.5 6.9 3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
}
function IconChevronDown(props) {
    return (<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M3.5 6L8 10.5L12.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
}
function IconCheck(props) {
    return (<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M3 8.5L6.2 11.7L13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
}
function IconUploadCloud(props) {
    return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M7.5 17.5C5 17.5 3 15.5 3 13C3 10.7 4.7 8.8 6.9 8.5C7.4 6 9.6 4 12.3 4C15.3 4 17.7 6.3 18 9.2C19.8 9.6 21 11.1 21 13C21 15.2 19.2 17 17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 20V11M12 11L9 14M12 11L15 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
}
function IconFileCheck(props) {
    return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M8.5 13.5L10.8 15.8L15.5 10.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
}
/* ------------------------------------------------------------------ */
/* Custom model dropdown — reads/writes the same modelId state the    */
/* native <select> used to, via onSelect. No parallel source of truth.*/
/* ------------------------------------------------------------------ */

/**
 * @param {{
 *   groupedModels: ModelGroup[],
 *   modelId: string,
 *   onSelect: (id: string) => void,
 *   disabled: boolean,
 *   preferredModelId: string,
 * }} props
 */
function ModelDropdown({ groupedModels, modelId, onSelect, disabled, preferredModelId }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        function handlePointerDown(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [open]);

    const selectedModel = useMemo(() => {
        for (const group of groupedModels) {
            const match = group.models.find((model) => model.id === modelId);
            if (match) {
                return { ...match, vendor: group.vendor };
            }
        }
        return undefined;
    }, [groupedModels, modelId]);

    const isEmpty = groupedModels.length === 0;
    const handleOptionSelect = (id) => {
        onSelect(id);
        setOpen(false);
    };
    const handleTriggerKeyDown = (event) => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!disabled && !isEmpty) {
                setOpen(true);
            }
        }
    };
    const handlePanelKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
        }
    };

    return (<div className={`model-dropdown ${open ? 'model-dropdown-open' : ''}`} ref={containerRef} onKeyDown={handlePanelKeyDown}>
      <button type="button" className="model-dropdown-trigger" disabled={disabled || isEmpty} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)} onKeyDown={handleTriggerKeyDown}>
        <span className="model-dropdown-trigger-label">
          <IconCube style={{ flex: '0 0 auto', color: 'var(--color-primary)' }}/>
          <span className="model-dropdown-trigger-name">
            {selectedModel ? selectedModel.displayName : (isEmpty ? 'Select a model to load' : 'Select a model')}
          </span>
        </span>
        {selectedModel && <span className="model-dropdown-trigger-vendor">{selectedModel.vendor}</span>}
        <IconChevronDown className="model-dropdown-chevron"/>
      </button>

      {open && !isEmpty && (<div className="model-dropdown-panel" role="listbox">
          <div className="model-dropdown-list">
            {groupedModels.flatMap((group) => group.models).map((model) => {
                const selected = model.id === modelId;
                const recommended = model.id === preferredModelId;
                return (<button type="button" key={model.id} role="option" aria-selected={selected} className={`model-dropdown-option ${selected ? 'model-dropdown-option-selected' : ''}`} onClick={() => handleOptionSelect(model.id)}>
                      <span className="model-dropdown-option-name">
                        {model.displayName}
                        {recommended && <span className="model-dropdown-badge">Recommended</span>}
                      </span>
                      {selected && <IconCheck className="model-dropdown-check"/>}
                    </button>);
            })}
          </div>
        </div>)}
    </div>);
}

/* ------------------------------------------------------------------ */
/* Upload card — same File-typed state as before, just a nicer face   */
/* over the (hidden) native file input.                               */
/* ------------------------------------------------------------------ */

/**
 * @param {{
 *   title: string,
 *   filename: string,
 *   accent: ('violet'|'green'),
 *   file: File|undefined,
 *   onSelect: (file: File|undefined) => void,
 *   disabled: boolean,
 * }} props
 */
function UploadCard({ title, filename, accent, file, onSelect, disabled }) {
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef(null);

    const handleFiles = (fileList) => {
        const picked = fileList?.[0];
        if (picked) {
            onSelect(picked);
        }
    };
    const handleDrop = (event) => {
        event.preventDefault();
        setDragOver(false);
        if (disabled) {
            return;
        }
        handleFiles(event.dataTransfer.files);
    };
    const handleClick = () => {
        if (!disabled) {
            inputRef.current?.click();
        }
    };
    const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick();
        }
    };

    const classes = [
        'upload-card',
        `upload-card-${accent}`,
        file ? 'upload-card-filled' : '',
        dragOver ? 'upload-card-dragover' : '',
    ].filter(Boolean).join(' ');

    return (<div>
      <div className="upload-card-label">{filename}</div>
      <div className={classes} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} onClick={handleClick} onKeyDown={handleKeyDown} onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) {
                setDragOver(true);
            }
        }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
        <input ref={inputRef} className="upload-card-input" type="file" accept=".zip" tabIndex={-1} onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
        }} disabled={disabled}/>
        <span className="upload-card-icon-wrap">
          {file ? <IconFileCheck /> : <IconUploadCloud />}
        </span>
        <span className="upload-card-text">
          <span className="upload-card-cta">{file ? file.name : title}</span>
          <span className="upload-card-hint">{file ? formatFileSize(file.size) : 'No file chosen'}</span>
        </span>
        {file && (<button type="button" className="upload-card-remove-x" disabled={disabled} aria-label={`Remove ${filename}`} onClick={(event) => {
                event.stopPropagation();
                onSelect(undefined);
            }}>
            <IconX />
          </button>)}
      </div>
    </div>);
}

/**
 * Uploads a base project (prefilled_code + solution_code only — testcase is
 * a fixed server-side template, see InMemoryAnalysisJobService) and an API
 * key for the chosen provider, so a project this tool has never generated
 * from before doesn't need a hand-authored spec.json. There's no scenario
 * description field — the model reads the uploaded project itself and
 * invents an appropriate new domain (see scenarioSpecDraftContract.ts, rule
 * 10), and the scenario/output folder naming is likewise fully derived from
 * its answer. Pasting or typing a key auto-detects its provider from the
 * key's own prefix (see detectProviderFromApiKey) and auto-loads that
 * provider's available models — no need to pick a provider or press a
 * "load" action first; the Provider radio still exists for the rare key
 * format the prefix check doesn't recognize.
 */
/** @param {AnalyzeFormProps} props */
export function AnalyzeForm({ submitting, models, modelsLoading, modelsError, onFetchModels, onProviderChange, onSubmit, }) {
    const [provider, setProvider] = useState('anthropic');
    const [apiKey, setApiKey] = useState('');
    const [modelId, setModelId] = useState('');
    const [prefilledCodeZip, setPrefilledCodeZip] = useState(undefined);
    const [solutionCodeZip, setSolutionCodeZip] = useState(undefined);
    const [showApiKey, setShowApiKey] = useState(false);
    // Detect the provider from the pasted key's own prefix instead of requiring the operator to
    // pick a provider first — sk-ant-/sk-or-/sk- are distinct enough to tell apart reliably. Only
    // switches when detection actually disagrees with the current selection, so re-running this
    // effect after the switch (provider is a dependency) is a no-op rather than a loop, and a key
    // format we don't recognize just leaves whatever was already selected alone.
    useEffect(() => {
        const trimmedKey = apiKey.trim();
        if (trimmedKey.length === 0) {
            return;
        }
        const detected = detectProviderFromApiKey(trimmedKey);
        if (detected && detected !== provider) {
            setProvider(detected);
            setModelId('');
            onProviderChange();
        }
    }, [apiKey, provider, onProviderChange]);
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
    const trimmedApiKey = apiKey.trim();
    const detectedProvider = trimmedApiKey.length > 0 ? detectProviderFromApiKey(trimmedApiKey) : undefined;
    const mistralKeyFormatHint = provider === 'mistral' &&
        trimmedApiKey.length > 0 &&
        !MISTRAL_API_KEY_PATTERN.test(trimmedApiKey)
        ? `Mistral keys are exactly 32 letters/numbers (no sk- prefix). Yours is ${trimmedApiKey.length} characters — it may be incomplete or from another service. Get a key at console.mistral.ai → API Keys.`
        : undefined;
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
        }
        else if (fallback) {
            setModelId(fallback.id);
        }
    }, [models, groupedModels, modelId, provider]);
    const handleProviderChange = (nextProvider) => {
        setProvider(nextProvider);
        setModelId('');
        onProviderChange();
    };
    const canSubmit = !submitting &&
        apiKey.trim().length > 0 &&
        modelId.length > 0 &&
        prefilledCodeZip &&
        solutionCodeZip;
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!canSubmit || !prefilledCodeZip || !solutionCodeZip) {
            return;
        }
        onSubmit({ provider, apiKey, modelId, prefilledCodeZip, solutionCodeZip });
    };
    return (<form className="analyze-form" onSubmit={handleSubmit}>
      <div>
        <span className="form-section-label">Provider</span>
        <div className="provider-grid" role="radiogroup" aria-label="Provider">
          {Object.keys(PROVIDER_LABELS).map((candidate) => {
            const Icon = PROVIDER_ICONS[candidate];
            const selected = provider === candidate;
            return (<label key={candidate} className={`provider-card ${selected ? 'provider-card-selected' : ''}`}>
                <input className="provider-card-input" type="radio" name="provider" value={candidate} checked={selected} onChange={() => handleProviderChange(candidate)} disabled={submitting}/>
                <span className="provider-card-left">
                  <span className={`provider-card-icon ${PROVIDER_ICON_CLASS[candidate]}`}>
                    <Icon />
                  </span>
                  <span className="provider-card-name">{PROVIDER_LABELS[candidate]}</span>
                </span>
                <span className={`provider-card-radio ${selected ? 'provider-card-radio-selected' : ''}`}>
                  {selected && <IconCheck />}
                </span>
              </label>);
        })}
        </div>
      </div>

      <div>
        <span className="form-section-label">{PROVIDER_LABELS[provider]} API Key</span>
        <div className="api-key-field">
          <span className="api-key-field-icon">
            <IconKey />
          </span>
          <input type={showApiKey ? 'text' : 'password'} placeholder={API_KEY_PLACEHOLDER[provider]} value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={submitting} aria-label={`${PROVIDER_LABELS[provider]} API key`}/>
          <button type="button" className="api-key-field-toggle" onClick={() => setShowApiKey((value) => !value)} aria-label={showApiKey ? 'Hide API key' : 'Show API key'} tabIndex={-1}>
            {showApiKey ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>
        {detectedProvider && (<p className="detected-provider-note">
            <IconCheck />
            Detected: {PROVIDER_LABELS[detectedProvider]} key — provider set automatically.
          </p>)}
        {mistralKeyFormatHint && <p className="error-text">{mistralKeyFormatHint}</p>}
        {modelsLoading && <p className="muted">Loading available models…</p>}
        {modelsError && <p className="error-text">{modelsError}</p>}
      </div>

      <div>
        <span className="form-section-label">Model</span>
        <ModelDropdown groupedModels={groupedModels} modelId={modelId} onSelect={setModelId} disabled={submitting || groupedModels.length === 0} preferredModelId={PREFERRED_DEFAULT_MODEL_ID[provider]}/>
      </div>

      <div>
        <span className="form-section-label">
          Project Files
          <span className="form-section-label-sub">Upload your project ZIP files</span>
        </span>
        <div className="upload-grid">
          <UploadCard title="Choose File" filename="prefilled_code.zip" accent="violet" file={prefilledCodeZip} onSelect={setPrefilledCodeZip} disabled={submitting}/>
          <UploadCard title="Choose File" filename="solution_code.zip" accent="green" file={solutionCodeZip} onSelect={setSolutionCodeZip} disabled={submitting}/>
        </div>
      </div>

      <div className="analyze-form-submit-row">
        <button type="submit" className="cta-button" disabled={!canSubmit}>
          {submitting ? (<>
              <span className="spinner" style={{ color: 'currentColor' }}/>
              Designing your scenario…
            </>) : (<>
              <IconRocket />
              Design My Scenario
            </>)}
        </button>
      </div>
    </form>);
}
