import type { AnalysisJob, GenerationJob, LlmProvider, ModelSummary } from '../types.js';

const BASE_URL = '/api';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `Request to "${path}" failed with status ${response.status}`);
  }
  return body;
}

/** No Content-Type header here on purpose — the browser sets multipart/form-data's boundary itself. */
async function requestJsonWithFormData<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { method: 'POST', body });
  const parsed = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(parsed.error ?? `Request to "${path}" failed with status ${response.status}`);
  }
  return parsed;
}

export interface SelfCorrectionCredentials {
  readonly provider: LlmProvider;
  readonly apiKey: string;
  readonly modelId: string;
}

export const apiClient = {
  /**
   * Passing `selfCorrect` opts the run into SelfCorrectingScenarioWorkflow —
   * a failing test in the drafted solution gets fed back to the model for a
   * revision instead of failing the job outright. Omit it to keep the
   * original one-shot, no-LLM-involved behavior.
   */
  async startGeneration(specPath: string, selfCorrect?: SelfCorrectionCredentials): Promise<string> {
    const { jobId } = await requestJson<{ jobId: string }>('/generations', {
      method: 'POST',
      body: JSON.stringify({
        specPath,
        ...(selfCorrect
          ? { provider: selfCorrect.provider, apiKey: selfCorrect.apiKey, modelId: selfCorrect.modelId }
          : {}),
      }),
    });
    return jobId;
  },

  async getJob(jobId: string): Promise<GenerationJob> {
    const { job } = await requestJson<{ job: GenerationJob }>(`/generations/${jobId}`);
    return job;
  },

  async startAnalysis(formData: FormData): Promise<string> {
    const { jobId } = await requestJsonWithFormData<{ jobId: string }>('/analyses', formData);
    return jobId;
  },

  async getAnalysisJob(jobId: string): Promise<AnalysisJob> {
    const { job } = await requestJson<{ job: AnalysisJob }>(`/analyses/${jobId}`);
    return job;
  },

  async listModels(provider: LlmProvider, apiKey: string): Promise<readonly ModelSummary[]> {
    const { models } = await requestJson<{ models: ModelSummary[] }>('/models', {
      method: 'POST',
      body: JSON.stringify({ provider, apiKey }),
    });
    return models;
  },
};
