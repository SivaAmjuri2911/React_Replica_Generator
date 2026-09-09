// Same-origin '/api' works when a reverse proxy sits in front of both frontend and backend
// (or in local dev, via vite.config.ts's proxy). Deployed as two separate origins (e.g.
// frontend on Vercel, backend on Render), set VITE_API_BASE_URL at build time to the
// backend's full URL instead — the backend already sends permissive CORS headers.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function parseJsonResponse(response, path) {
    const text = await response.text();
    if (text.trim().length === 0) {
        throw new Error(response.ok
            ? `Server returned an empty response for "${path}"`
            : `Could not reach the API (${response.status}) — is the backend running? Start it with "npm run serve" in the backend folder.`);
    }
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error(`Server returned a non-JSON response for "${path}" (status ${response.status})`);
    }
}

async function requestJson(path, init) {
    const response = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
    });
    const body = await parseJsonResponse(response, path);
    if (!response.ok) {
        throw new Error(body.error ?? `Request to "${path}" failed with status ${response.status}`);
    }
    return body;
}

async function requestEmpty(path, init) {
    const response = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
    });
    if (response.ok) {
        return;
    }
    const text = await response.text();
    if (text.trim().length === 0) {
        throw new Error(`Request to "${path}" failed with status ${response.status}`);
    }
    try {
        const body = JSON.parse(text);
        throw new Error(body.error ?? `Request to "${path}" failed with status ${response.status}`);
    }
    catch (error) {
        if (error instanceof Error && error.message.startsWith('Request to')) {
            throw error;
        }
        throw new Error(`Request to "${path}" failed with status ${response.status}`);
    }
}
/** No Content-Type header here on purpose — the browser sets multipart/form-data's boundary itself. */
/** @param {string|undefined} header */
function parseContentDispositionFilename(header) {
    if (!header) {
        return undefined;
    }
    const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (utfMatch?.[1]) {
        return decodeURIComponent(utfMatch[1]);
    }
    const quotedMatch = /filename="([^"]+)"/i.exec(header);
    if (quotedMatch?.[1]) {
        return quotedMatch[1];
    }
    const plainMatch = /filename=([^;]+)/i.exec(header);
    return plainMatch?.[1]?.trim();
}

/** @param {string} path @param {string} fallbackFilename */
async function downloadFromApi(path, fallbackFilename) {
    const response = await fetch(`${BASE_URL}${path}`);
    if (!response.ok) {
        const text = await response.text();
        let message = `Download failed with status ${response.status}`;
        if (text.trim().length > 0) {
            try {
                const body = JSON.parse(text);
                message = typeof body.error === 'string' ? body.error : text;
            }
            catch {
                message = text;
            }
        }
        throw new Error(message);
    }
    const blob = await response.blob();
    const filename = parseContentDispositionFilename(response.headers.get('Content-Disposition')) ?? fallbackFilename;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
}

async function requestJsonWithFormData(path, body) {
    const response = await fetch(`${BASE_URL}${path}`, { method: 'POST', body });
    const parsed = await parseJsonResponse(response, path);
    if (!response.ok) {
        throw new Error(parsed.error ?? `Request to "${path}" failed with status ${response.status}`);
    }
    return parsed;
}
/**
 * @typedef {object} SelfCorrectionCredentials
 * @property {import('../types.js').LlmProvider} provider
 * @property {string} apiKey
 * @property {string} modelId
 */

/**
 * @typedef {object} ScenarioSummary
 * @property {string} specPath
 * @property {string} scenarioName
 * @property {string} outputFolderBaseName
 * @property {string} testPrefix
 */

/**
 * @typedef {object} AnalysisSessionSummary
 * @property {string} slug
 * @property {string|undefined} scenarioName
 * @property {string|undefined} specPath
 * @property {boolean} hasUploads
 * @property {boolean} hasSpec
 * @property {boolean} [hasOutput]
 * @property {boolean} [hasTestcase]
 * @property {boolean} [hasIdeBasedCoding]
 * @property {string|undefined} [testcaseRelativePath]
 * @property {string|undefined} [ideBasedCodingRelativePath]
 * @property {string|undefined} updatedAt
 */

export const apiClient = {
    /**
     * Passing `selfCorrect` opts the run into SelfCorrectingScenarioWorkflow —
     * a failing test in the drafted solution gets fed back to the model for a
     * revision instead of failing the job outright. Omit it to keep the
     * original one-shot, no-LLM-involved behavior.
     */
    async startGeneration(specPath, selfCorrect) {
        const { jobId } = await requestJson('/generations', {
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
    async getJob(jobId) {
        const { job } = await requestJson(`/generations/${jobId}`);
        return job;
    },
    async startAnalysis(formData) {
        const { jobId } = await requestJsonWithFormData('/analyses', formData);
        return jobId;
    },
    async getAnalysisJob(jobId) {
        const { job } = await requestJson(`/analyses/${jobId}`);
        return job;
    },
    async cancelAnalysisJob(jobId) {
        await requestEmpty(`/analyses/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' });
    },
    async listModels(provider, apiKey) {
        const { models } = await requestJson('/models', {
            method: 'POST',
            body: JSON.stringify({ provider, apiKey }),
        });
        return models;
    },
    async listAnalysisJobs() {
        const { jobs } = await requestJson('/analyses');
        return jobs;
    },
    async listGenerationJobs() {
        const { jobs } = await requestJson('/generations');
        return jobs;
    },
    async listScenarios() {
        const { scenarios } = await requestJson('/scenarios');
        return scenarios;
    },
    async listAnalysisSessions() {
        const { sessions } = await requestJson('/analysis-sessions');
        return sessions;
    },
    /** @param {File} scenariosZip */
    async importAnalysisSessions(scenariosZip) {
        const formData = new FormData();
        formData.append('scenariosZip', scenariosZip);
        return requestJsonWithFormData('/analysis-sessions/import', formData);
    },
    /**
     * @param {string} slug
     * @param {string} [fallbackFilename]
     */
    async downloadSessionZip(slug, fallbackFilename) {
        await downloadFromApi(`/analysis-sessions/${encodeURIComponent(slug)}/download`, fallbackFilename ?? `${slug}.zip`);
    },
    /** @param {string} jobId @param {string} [fallbackFilename] */
    async downloadGenerationZip(jobId, fallbackFilename) {
        await downloadFromApi(`/generations/${encodeURIComponent(jobId)}/download`, fallbackFilename ?? 'replica.zip');
    },
    /** @param {string} slug */
    async listSessionFileTree(slug) {
        const { tree } = await requestJson(`/analysis-sessions/${encodeURIComponent(slug)}/tree`);
        return tree;
    },
    /**
     * @param {string} slug
     * @param {string} relativePath
     */
    async readSessionFile(slug, relativePath) {
        const query = new URLSearchParams({ path: relativePath });
        return requestJson(`/analysis-sessions/${encodeURIComponent(slug)}/files?${query.toString()}`);
    },
    /**
     * @param {string} slug
     * @param {string} relativePath
     * @param {string} content
     */
    async writeSessionFile(slug, relativePath, content) {
        return requestJson(`/analysis-sessions/${encodeURIComponent(slug)}/files`, {
            method: 'PUT',
            body: JSON.stringify({ path: relativePath, content }),
        });
    },
    /**
     * @param {string} slug
     * @param {string} relativeDir
     * @param {string} script
     */
    async runSessionScript(slug, relativeDir, script) {
        return requestJson(`/analysis-sessions/${encodeURIComponent(slug)}/run`, {
            method: 'POST',
            body: JSON.stringify({ relativeDir, script }),
        });
    },
    /**
     * @param {{
     *   analysisJobId?: string,
     *   generationJobId?: string,
     *   sessionSlug?: string,
     * }} target
     */
    async deleteProject(target) {
        if (target.analysisJobId) {
            await requestEmpty(`/analyses/${target.analysisJobId}`, { method: 'DELETE' });
            return;
        }
        if (target.generationJobId) {
            await requestEmpty(`/generations/${target.generationJobId}`, { method: 'DELETE' });
            return;
        }
        if (target.sessionSlug) {
            await requestEmpty(`/analysis-sessions/${encodeURIComponent(target.sessionSlug)}`, { method: 'DELETE' });
            return;
        }
        throw new Error('Nothing to delete for this project');
    },
};
