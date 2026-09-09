const ACTIVE_ANALYSIS_JOB_KEY = 'replica-generator:activeAnalysisJobId';
const ACTIVE_GENERATION_JOB_KEY = 'replica-generator:activeGenerationJobId';

/** @returns {string|undefined} */
export function readStoredAnalysisJobId() {
    const value = localStorage.getItem(ACTIVE_ANALYSIS_JOB_KEY);
    return value && value.length > 0 ? value : undefined;
}

/** @returns {string|undefined} */
export function readStoredGenerationJobId() {
    const value = localStorage.getItem(ACTIVE_GENERATION_JOB_KEY);
    return value && value.length > 0 ? value : undefined;
}

/** @param {string|undefined} jobId */
export function storeAnalysisJobId(jobId) {
    if (jobId) {
        localStorage.setItem(ACTIVE_ANALYSIS_JOB_KEY, jobId);
        return;
    }
    localStorage.removeItem(ACTIVE_ANALYSIS_JOB_KEY);
}

/** @param {string|undefined} jobId */
export function storeGenerationJobId(jobId) {
    if (jobId) {
        localStorage.setItem(ACTIVE_GENERATION_JOB_KEY, jobId);
        return;
    }
    localStorage.removeItem(ACTIVE_GENERATION_JOB_KEY);
}
