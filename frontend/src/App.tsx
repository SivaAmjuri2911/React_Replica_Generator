import { useCallback, useEffect, useState } from 'react';
import { apiClient } from './api/client.js';
import type { SelfCorrectionCredentials } from './api/client.js';
import { JobStatusPanel } from './components/JobStatusPanel.js';
import { AnalyzeForm } from './components/AnalyzeForm.js';
import type { AnalyzeFormValues } from './components/AnalyzeForm.js';
import { AnalysisStatusPanel } from './components/AnalysisStatusPanel.js';
import { StepTracker } from './components/StepTracker.js';
import { toStepTrackerItems } from './utils/stepProgress.js';
import { useJobPolling } from './hooks/useJobPolling.js';
import { useAnalysisJobPolling } from './hooks/useAnalysisJobPolling.js';
import type { LlmProvider, ModelSummary } from './types.js';
import './App.css';

export function App(): JSX.Element {
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [activeJobId, setActiveJobId] = useState<string | undefined>(undefined);
  const [generatingSpecPath, setGeneratingSpecPath] = useState<string | undefined>(undefined);
  const [activeAnalysisJobId, setActiveAnalysisJobId] = useState<string | undefined>(undefined);
  const [analyzing, setAnalyzing] = useState(false);
  const [models, setModels] = useState<readonly ModelSummary[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | undefined>(undefined);
  // Kept only in memory (never sent anywhere but the generate call itself) so "Generate from
  // this draft" can re-enter self-correction with the same credentials used to draft it,
  // instead of the operator having to paste the key a second time.
  const [draftCredentials, setDraftCredentials] = useState<SelfCorrectionCredentials | undefined>(undefined);

  const { job, error: pollError } = useJobPolling(activeJobId);
  const { job: analysisJob, error: analysisPollError } = useAnalysisJobPolling(activeAnalysisJobId);

  // Drives the two-column "step tracker on the left" layout — collapses back to a single
  // column once a job reaches a terminal status (succeeded/failed) or before one exists.
  const isBuildActive = job !== undefined && (job.status === 'pending' || job.status === 'running');
  const isDesignActive = analysisJob !== undefined && (analysisJob.status === 'pending' || analysisJob.status === 'running');

  useEffect(() => {
    if (job && (job.status === 'succeeded' || job.status === 'failed')) {
      setGeneratingSpecPath(undefined);
    }
  }, [job]);

  useEffect(() => {
    if (analysisJob && (analysisJob.status === 'succeeded' || analysisJob.status === 'failed')) {
      setAnalyzing(false);
    }
  }, [analysisJob]);

  const handleGenerate = useCallback(
    async (specPath: string) => {
      setGeneratingSpecPath(specPath);
      try {
        const jobId = await apiClient.startGeneration(specPath, draftCredentials);
        setActiveJobId(jobId);
      } catch (error) {
        setGeneratingSpecPath(undefined);
        setLoadError(error instanceof Error ? error.message : String(error));
      }
    },
    [draftCredentials]
  );

  const handleAnalyze = useCallback(async (values: AnalyzeFormValues) => {
    setAnalyzing(true);
    setDraftCredentials({ provider: values.provider, apiKey: values.apiKey, modelId: values.modelId });
    const formData = new FormData();
    formData.set('provider', values.provider);
    formData.set('apiKey', values.apiKey);
    formData.set('modelId', values.modelId);
    formData.set('prefilledCode', values.prefilledCodeZip);
    formData.set('solutionCode', values.solutionCodeZip);

    try {
      const jobId = await apiClient.startAnalysis(formData);
      setActiveAnalysisJobId(jobId);
    } catch (error) {
      setAnalyzing(false);
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const handleFetchModels = useCallback(async (provider: LlmProvider, apiKey: string) => {
    setModelsLoading(true);
    setModelsError(undefined);
    try {
      const result = await apiClient.listModels(provider, apiKey);
      setModels(result);
    } catch (error) {
      setModels([]);
      setModelsError(error instanceof Error ? error.message : String(error));
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const handleProviderChange = useCallback(() => {
    setModels([]);
    setModelsError(undefined);
  }, []);

  return (
    <main className="app">
      <header>
        <h1>Replica Generator</h1>
        <p className="muted">
          Generate a new prefilled_code / solution_code / testcase / IDE_BASED_CODING scenario from a spec.
        </p>
      </header>

      {loadError && <p className="error-text">{loadError}</p>}

      <section>
        <h2>Design a New Scenario From Your Project</h2>
        <p className="muted">
          Pick a provider, paste your API key, pick a model, and upload prefilled_code / solution_code
          as zips — the model reads the project itself, invents an appropriate new scenario, and
          drafts the transformation spec, the same shape as a hand-authored one.
        </p>
        <AnalyzeForm
          submitting={analyzing}
          models={models}
          modelsLoading={modelsLoading}
          modelsError={modelsError}
          onFetchModels={handleFetchModels}
          onProviderChange={handleProviderChange}
          onSubmit={handleAnalyze}
        />
      </section>

      {activeAnalysisJobId && (
        <section>
          <h2>Designing Your Scenario</h2>
          {analysisPollError && <p className="error-text">{analysisPollError}</p>}
          {analysisJob ? (
            isDesignActive ? (
              <div className="job-layout">
                <div className="step-tracker-panel">
                  <StepTracker title="Design steps" items={toStepTrackerItems(analysisJob.phases, analysisJob.logs)} />
                </div>
                <div className="job-layout-main">
                  <AnalysisStatusPanel
                    job={analysisJob}
                    generating={generatingSpecPath !== undefined}
                    onGenerate={handleGenerate}
                  />
                </div>
              </div>
            ) : (
              <AnalysisStatusPanel job={analysisJob} generating={generatingSpecPath !== undefined} onGenerate={handleGenerate} />
            )
          ) : (
            <p className="muted">Starting…</p>
          )}
        </section>
      )}

      {activeJobId && (
        <section>
          <h2>Building Your Replica</h2>
          {pollError && <p className="error-text">{pollError}</p>}
          {job ? (
            isBuildActive ? (
              <div className="job-layout">
                <div className="step-tracker-panel">
                  <StepTracker title="Build steps" items={toStepTrackerItems(job.steps, job.logs)} />
                </div>
                <div className="job-layout-main">
                  <JobStatusPanel job={job} />
                </div>
              </div>
            ) : (
              <JobStatusPanel job={job} />
            )
          ) : (
            <p className="muted">Starting…</p>
          )}
        </section>
      )}
    </main>
  );
}
