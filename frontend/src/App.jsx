import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from './api/client.js';
import { AnalyzeForm } from './components/AnalyzeForm.jsx';
import { SiteHeader } from './components/SiteHeader.jsx';
import { RecentJobsPanel, buildRecentProjectItems, resolveOpenedProject } from './components/RecentJobsPanel.jsx';
import { OpenedProjectPanel } from './components/OpenedProjectPanel.jsx';
import { ProjectEditorPage } from './components/ProjectEditorPage.jsx';
import { ConfirmModal } from './components/ConfirmModal.jsx';
import { useJobPolling } from './hooks/useJobPolling.js';
import { useAnalysisJobPolling } from './hooks/useAnalysisJobPolling.js';
import { useRecentJobs } from './hooks/useRecentJobs.js';
import { readStoredAnalysisJobId, readStoredGenerationJobId, storeAnalysisJobId, storeGenerationJobId, } from './utils/jobSession.js';
import './App.css';

const HIGHLIGHT_COLORS = {
    prefilled_code: 'hl-blue',
    solution_code: 'hl-green',
    testcase: 'hl-pink',
    IDE_BASED_CODING: 'hl-orange',
};
const HIGHLIGHT_PATTERN = new RegExp(`(${Object.keys(HIGHLIGHT_COLORS).join('|')})`, 'g');

function withHighlightedKeywords(text) {
    return text.split(HIGHLIGHT_PATTERN).map((part, index) => HIGHLIGHT_COLORS[part] ? <span key={index} className={HIGHLIGHT_COLORS[part]}>{part}</span> : part);
}

export function App() {
    const [loadError, setLoadError] = useState(undefined);
    const [activeJobId, setActiveJobId] = useState(undefined);
    const [generatingSpecPath, setGeneratingSpecPath] = useState(undefined);
    const [activeAnalysisJobId, setActiveAnalysisJobId] = useState(undefined);
    const [openedProjectId, setOpenedProjectId] = useState(undefined);
    const [sessionRestored, setSessionRestored] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [models, setModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [modelsError, setModelsError] = useState(undefined);
    const [draftCredentials, setDraftCredentials] = useState(undefined);
    const [deletingProjectId, setDeletingProjectId] = useState(undefined);
    const [pendingDeleteItem, setPendingDeleteItem] = useState(undefined);
    const [activePage, setActivePage] = useState('design');
    const [fileTreeRefreshToken, setFileTreeRefreshToken] = useState(0);
    const { job, error: pollError } = useJobPolling(activeJobId);
    const { job: analysisJob, error: analysisPollError } = useAnalysisJobPolling(activeAnalysisJobId);
    const { analysisJobs, generationJobs, analysisSessions, loading: recentJobsLoading, error: recentJobsError, refresh: refreshRecentJobs, } = useRecentJobs();

    const openedProjectPanelRef = useRef(null);
    const recentProjectItems = useMemo(() => buildRecentProjectItems({ analysisJobs, generationJobs, analysisSessions }), [analysisJobs, generationJobs, analysisSessions]);
    const openedProject = useMemo(() => resolveOpenedProject(openedProjectId, recentProjectItems, analysisJob, job), [openedProjectId, recentProjectItems, analysisJob, job]);
    const hasActiveJob = (analysisJob?.status === 'pending' || analysisJob?.status === 'running')
        || (job?.status === 'pending' || job?.status === 'running');
    const isDesignSessionProject = Boolean(openedProject && (hasActiveJob
        || (openedProjectId?.startsWith('design-') && activeAnalysisJobId)
        || (openedProjectId?.startsWith('build-') && activeJobId)));

    useEffect(() => {
        if (!openedProjectId || activePage !== 'design' || !isDesignSessionProject) {
            return;
        }
        openedProjectPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [openedProjectId, activePage, isDesignSessionProject]);

    useEffect(() => {
        if (!hasActiveJob) {
            return;
        }
        void refreshRecentJobs();
        const intervalId = setInterval(() => {
            void refreshRecentJobs();
        }, 2000);
        return () => clearInterval(intervalId);
    }, [hasActiveJob, refreshRecentJobs]);

    useEffect(() => {
        if (job && (job.status === 'succeeded' || job.status === 'failed')) {
            setGeneratingSpecPath(undefined);
        }
        if (job?.status === 'succeeded') {
            void refreshRecentJobs();
            setFileTreeRefreshToken((current) => current + 1);
            // Stay on build-{jobId} so OpenedProjectPanel keeps showing the manual download banner.
        }
    }, [job, refreshRecentJobs]);
    useEffect(() => {
        if (analysisJob && (analysisJob.status === 'succeeded' || analysisJob.status === 'failed')) {
            setAnalyzing(false);
            if (analysisJob.status === 'failed') {
                storeAnalysisJobId(undefined);
            }
        }
    }, [analysisJob]);

    useEffect(() => {
        if (recentJobsLoading || sessionRestored) {
            return;
        }
        const storedGenerationJobId = readStoredGenerationJobId();
        const storedAnalysisJobId = readStoredAnalysisJobId();
        const liveGenerationJob = storedGenerationJobId
            ? generationJobs.find((entry) => entry.id === storedGenerationJobId)
            : undefined;
        const liveAnalysisJob = storedAnalysisJobId
            ? analysisJobs.find((entry) => entry.id === storedAnalysisJobId)
            : undefined;

        if (liveGenerationJob && (liveGenerationJob.status === 'pending' || liveGenerationJob.status === 'running')) {
            setActiveJobId(liveGenerationJob.id);
            setActiveAnalysisJobId(undefined);
            setOpenedProjectId(`build-${liveGenerationJob.id}`);
        }
        else if (liveAnalysisJob && (liveAnalysisJob.status === 'pending' || liveAnalysisJob.status === 'running')) {
            setActiveAnalysisJobId(liveAnalysisJob.id);
            setActiveJobId(undefined);
            setOpenedProjectId(`design-${liveAnalysisJob.id}`);
        }
        else {
            storeGenerationJobId(undefined);
            storeAnalysisJobId(undefined);
        }
        setSessionRestored(true);
    }, [recentJobsLoading, sessionRestored, generationJobs, analysisJobs]);

    useEffect(() => {
        if (!sessionRestored || recentJobsLoading) {
            return;
        }
        if (activeJobId && pollError?.includes('No job found') && !job) {
            const staleJobId = activeJobId;
            storeGenerationJobId(undefined);
            setActiveJobId(undefined);
            if (openedProjectId === `build-${staleJobId}`) {
                setOpenedProjectId(undefined);
            }
        }
        if (activeAnalysisJobId && analysisPollError?.includes('No job found') && !analysisJob) {
            const staleJobId = activeAnalysisJobId;
            storeAnalysisJobId(undefined);
            setActiveAnalysisJobId(undefined);
            if (openedProjectId === `design-${staleJobId}`) {
                setOpenedProjectId(undefined);
            }
        }
    }, [sessionRestored, recentJobsLoading, activeJobId, activeAnalysisJobId, pollError, analysisPollError, job, analysisJob, openedProjectId]);

    const handleGenerate = useCallback(async (specPath) => {
        setGeneratingSpecPath(specPath);
        try {
            const jobId = await apiClient.startGeneration(specPath, draftCredentials);
            setActiveJobId(jobId);
            setActiveAnalysisJobId(undefined);
            setOpenedProjectId(`build-${jobId}`);
            setActivePage('design');
            storeGenerationJobId(jobId);
            void refreshRecentJobs();
        }
        catch (error) {
            setGeneratingSpecPath(undefined);
            setLoadError(error instanceof Error ? error.message : String(error));
        }
    }, [draftCredentials, refreshRecentJobs]);

    const handleAnalyze = useCallback(async (values) => {
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
            setActiveJobId(undefined);
            setOpenedProjectId(`design-${jobId}`);
            setActivePage('design');
            storeAnalysisJobId(jobId);
            void refreshRecentJobs();
        }
        catch (error) {
            setAnalyzing(false);
            setLoadError(error instanceof Error ? error.message : String(error));
        }
    }, [refreshRecentJobs]);

    const handleFetchModels = useCallback(async (provider, apiKey) => {
        setModelsLoading(true);
        setModelsError(undefined);
        try {
            const result = await apiClient.listModels(provider, apiKey);
            setModels(result);
        }
        catch (error) {
            setModels([]);
            setModelsError(error instanceof Error ? error.message : String(error));
        }
        finally {
            setModelsLoading(false);
        }
    }, []);

    const handleProviderChange = useCallback(() => {
        setModels([]);
        setModelsError(undefined);
    }, []);

    const handleOpenProject = useCallback((item) => {
        setOpenedProjectId(item.id);
        if (item.isRunning) {
            setActivePage('design');
            if (item.analysisJobId) {
                setActiveAnalysisJobId(item.analysisJobId);
                setActiveJobId(undefined);
                storeAnalysisJobId(item.analysisJobId);
                return;
            }
            if (item.generationJobId) {
                setActiveJobId(item.generationJobId);
                setActiveAnalysisJobId(undefined);
                storeGenerationJobId(item.generationJobId);
                return;
            }
        }
        setActivePage('editor');
        setActiveAnalysisJobId(undefined);
        setActiveJobId(undefined);
    }, []);

    const handleEditorBack = useCallback(() => {
        setActivePage('projects');
    }, []);

    const handleCloseProject = useCallback(() => {
        setOpenedProjectId(undefined);
        setActiveAnalysisJobId(undefined);
        setActiveJobId(undefined);
        storeAnalysisJobId(undefined);
        storeGenerationJobId(undefined);
    }, []);

    const handleCancelDesign = useCallback(async (analysisJobId) => {
        setLoadError(undefined);
        try {
            await apiClient.cancelAnalysisJob(analysisJobId);
            setActiveAnalysisJobId(undefined);
            setOpenedProjectId(undefined);
            storeAnalysisJobId(undefined);
            setAnalyzing(false);
            void refreshRecentJobs();
        }
        catch (error) {
            setLoadError(error instanceof Error ? error.message : String(error));
        }
    }, [refreshRecentJobs]);

    const handleDeleteProjectRequest = useCallback((item) => {
        setPendingDeleteItem(item);
    }, []);

    const handleDeleteProjectCancel = useCallback(() => {
        if (!deletingProjectId) {
            setPendingDeleteItem(undefined);
        }
    }, [deletingProjectId]);

    const handleDeleteProjectConfirm = useCallback(async () => {
        const item = pendingDeleteItem;
        if (!item) {
            return;
        }
        setDeletingProjectId(item.id);
        setLoadError(undefined);
        try {
            await apiClient.deleteProject({
                analysisJobId: item.analysisJobId,
                generationJobId: item.generationJobId,
                sessionSlug: !item.analysisJobId && !item.generationJobId ? item.sessionSlug : undefined,
            });
            if (item.analysisJobId) {
                if (activeAnalysisJobId === item.analysisJobId) {
                    setActiveAnalysisJobId(undefined);
                }
                storeAnalysisJobId(undefined);
            }
            if (item.generationJobId) {
                if (activeJobId === item.generationJobId) {
                    setActiveJobId(undefined);
                }
                storeGenerationJobId(undefined);
            }
            if (openedProjectId === item.id) {
                setOpenedProjectId(undefined);
            }
            setPendingDeleteItem(undefined);
            void refreshRecentJobs();
        }
        catch (error) {
            setLoadError(error instanceof Error ? error.message : String(error));
        }
        finally {
            setDeletingProjectId(undefined);
        }
    }, [activeAnalysisJobId, activeJobId, openedProjectId, pendingDeleteItem, refreshRecentJobs]);

    return (<>
      <SiteHeader activePage={activePage} projectCount={recentProjectItems.length} onNavigate={setActivePage}/>

      <main className="app">
      {loadError && <p className="error-text app-banner">{loadError}</p>}

      {activePage === 'design' && (<section className="project-surface main-card">
        <div className="main-card-header">
          <div className="main-card-header-top">
            <span className="main-card-header-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path d="M8 1Q9.5 6.5 15 8Q9.5 9.5 8 15Q6.5 9.5 1 8Q6.5 6.5 8 1Z" fill="currentColor"/>
              </svg>
            </span>
            <div>
              <h2>Design a New Scenario From Your Project</h2>
              <p className="muted">
                {withHighlightedKeywords('Pick a provider, paste your API key, pick a model, and upload prefilled_code / solution_code as zips — the model reads the project itself, invents an appropriate new scenario, and drafts the transformation spec, the same shape as a hand-authored one.')}
              </p>
            </div>
          </div>
          <div className="main-card-decor" aria-hidden="true">
            <span className="main-card-decor-spark s1">✦</span>
            <span className="main-card-decor-spark s2">✦</span>
            <span className="main-card-decor-spark s3">✦</span>
            <div className="main-card-decor-window">
              <span className="main-card-decor-dot"/><span className="main-card-decor-dot"/><span className="main-card-decor-dot"/>
              <div className="main-card-decor-code">{'</>'}</div>
            </div>
          </div>
        </div>
        <AnalyzeForm submitting={analyzing} models={models} modelsLoading={modelsLoading} modelsError={modelsError} onFetchModels={handleFetchModels} onProviderChange={handleProviderChange} onSubmit={handleAnalyze}/>
      </section>)}

      {activePage === 'design' && isDesignSessionProject && openedProject && (<div ref={openedProjectPanelRef}>
          <OpenedProjectPanel compactInitialView={!openedProject.isRunning} item={openedProject} analysisJob={openedProject.isRunning && openedProject.analysisJobId ? analysisJob : undefined} generationJob={openedProject.isRunning && openedProject.generationJobId ? job : undefined} analysisPollError={analysisPollError} generationPollError={pollError} generating={generatingSpecPath !== undefined} onGenerate={handleGenerate} onCancelDesign={handleCancelDesign} onClose={handleCloseProject} fileTreeRefreshToken={fileTreeRefreshToken} onActionError={setLoadError}/>
        </div>)}

      {activePage === 'projects' && (<RecentJobsPanel analysisJobs={analysisJobs} generationJobs={generationJobs} analysisSessions={analysisSessions} openedProjectId={openedProjectId} deletingProjectId={deletingProjectId} loading={recentJobsLoading} error={recentJobsError} onOpenProject={handleOpenProject} onDeleteProject={handleDeleteProjectRequest} onBuildFromSpec={handleGenerate} onActionError={setLoadError} onProjectsImported={refreshRecentJobs}/>)}

      {activePage === 'editor' && openedProject && (<ProjectEditorPage item={openedProject} generating={generatingSpecPath !== undefined} onGenerate={handleGenerate} onBack={handleEditorBack} onActionError={setLoadError} fileTreeRefreshToken={fileTreeRefreshToken}/>)}
    </main>

      <ConfirmModal open={pendingDeleteItem !== undefined} title="Delete project?" message={pendingDeleteItem ? `Delete "${pendingDeleteItem.title}"? This removes it from the list and deletes saved files on disk where applicable.` : ''} confirmLabel="Delete" cancelLabel="Cancel" danger loading={deletingProjectId !== undefined} onConfirm={() => void handleDeleteProjectConfirm()} onCancel={handleDeleteProjectCancel}/>
    </>);
}
