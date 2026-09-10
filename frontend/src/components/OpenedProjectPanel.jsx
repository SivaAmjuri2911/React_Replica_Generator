import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client.js';
import { AnalysisStatusPanel } from './AnalysisStatusPanel.jsx';
import { JobStatusPanel } from './JobStatusPanel.jsx';
import { ReplicaSuccessDownload } from './ReplicaSuccessDownload.jsx';
import { ProjectFileWorkspace } from './ProjectFileWorkspace.jsx';
import { StepTracker } from './StepTracker.jsx';
import { toStepTrackerItems } from '../utils/stepProgress.js';
import { resolveSessionSlug } from '../utils/sessionSlug.js';

/**
 * @typedef {object} OpenedProjectPanelProps
 * @property {import('./RecentJobsPanel.jsx').RecentProjectItem} item
 * @property {import('../types.js').AnalysisJob|undefined} analysisJob
 * @property {import('../types.js').GenerationJob|undefined} generationJob
 * @property {string|undefined} analysisPollError
 * @property {string|undefined} generationPollError
 * @property {boolean} generating
 * @property {boolean} [compactInitialView]
 * @property {(specPath: string) => void} onGenerate
 * @property {(analysisJobId: string) => void} [onCancelDesign]
 * @property {() => void} onClose
 * @property {number} [fileTreeRefreshToken]
 * @property {(message: string) => void} [onActionError]
 */

/** @param {OpenedProjectPanelProps} props */
export function OpenedProjectPanel({ item, analysisJob, generationJob, analysisPollError, generationPollError, generating, compactInitialView = false, onGenerate, onCancelDesign, onClose, fileTreeRefreshToken = 0, onActionError, }) {
    const isDesignActive = analysisJob !== undefined && (analysisJob.status === 'pending' || analysisJob.status === 'running');
    const isBuildActive = generationJob !== undefined && (generationJob.status === 'pending' || generationJob.status === 'running');
    const isJobRunning = isDesignActive || isBuildActive;
    const sessionSlug = resolveSessionSlug(item);
    const [folderOpen, setFolderOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(!compactInitialView);
    const [loadedAnalysisJob, setLoadedAnalysisJob] = useState(undefined);
    const [loadedGenerationJob, setLoadedGenerationJob] = useState(undefined);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [detailsError, setDetailsError] = useState(undefined);
    const folderPanelRef = useRef(null);

    useEffect(() => {
        setFolderOpen(false);
        setDetailsOpen(!compactInitialView);
        setLoadedAnalysisJob(undefined);
        setLoadedGenerationJob(undefined);
        setDetailsError(undefined);
    }, [item.id, compactInitialView]);

    useEffect(() => {
        if (isJobRunning) {
            setDetailsOpen(true);
        }
    }, [isJobRunning, item.id]);

    useEffect(() => {
        if (!folderOpen) {
            return;
        }
        folderPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [folderOpen]);

    const displayAnalysisJob = isDesignActive ? analysisJob : loadedAnalysisJob;
    const displayGenerationJob = isBuildActive ? generationJob : loadedGenerationJob;
    const hasJobHistory = Boolean(item.analysisJobId || item.generationJobId);
    const showJobDetails = detailsOpen && (isJobRunning || displayAnalysisJob || displayGenerationJob || loadingDetails);
    const buildSucceeded = displayGenerationJob?.status === 'succeeded' && Boolean(displayGenerationJob.result);
    const isBuiltOnDisk = item.kind === 'Build' && Boolean(item.specPath) && !isJobRunning;
    const showSuccessDownload = buildSucceeded || isBuiltOnDisk;

    const handleToggleDetails = useCallback(async () => {
        if (detailsOpen) {
            setDetailsOpen(false);
            return;
        }
        if (isJobRunning) {
            setDetailsOpen(true);
            return;
        }
        setDetailsOpen(true);
        if (displayAnalysisJob || displayGenerationJob) {
            return;
        }
        setLoadingDetails(true);
        setDetailsError(undefined);
        try {
            if (item.generationJobId) {
                const loaded = await apiClient.getJob(item.generationJobId);
                setLoadedGenerationJob(loaded);
            }
            else if (item.analysisJobId) {
                const loaded = await apiClient.getAnalysisJob(item.analysisJobId);
                setLoadedAnalysisJob(loaded);
            }
        }
        catch (error) {
            setDetailsError(error instanceof Error ? error.message : String(error));
        }
        finally {
            setLoadingDetails(false);
        }
    }, [detailsOpen, isJobRunning, displayAnalysisJob, displayGenerationJob, item.analysisJobId, item.generationJobId]);

    return (<section className="project-surface opened-project-panel">
      <div className="opened-project-panel-header">
        <div>
          <span className="opened-project-panel-top">
            <span className="project-kind-badge">{item.kind}</span>
            <span className={`status-badge status-${item.status}`}>{item.label}</span>
          </span>
          <h2>{item.title}</h2>
          <p className="muted">{item.detail}</p>
        </div>
        <div className="opened-project-panel-actions">
          {isDesignActive && item.analysisJobId && onCancelDesign && (<button type="button" className="project-action-btn project-action-btn-danger" onClick={() => onCancelDesign(item.analysisJobId)}>
              Cancel design
            </button>)}
          {item.specPath && !isJobRunning && (<button type="button" className="project-action-btn" disabled={generating} onClick={() => onGenerate(item.specPath)}>
              {generating ? 'Building…' : 'Build'}
            </button>)}
          {hasJobHistory && (<button type="button" className="project-action-btn" onClick={() => void handleToggleDetails()} disabled={loadingDetails}>
              {loadingDetails ? 'Loading…' : detailsOpen ? 'Hide details' : 'View details'}
            </button>)}
          {sessionSlug && (<button type="button" className="project-action-btn project-action-btn-primary" onClick={() => setFolderOpen((open) => !open)} aria-expanded={folderOpen}>
              {folderOpen ? 'Hide folder' : 'Open folder'}
            </button>)}
          <button type="button" className="project-action-btn" onClick={onClose} aria-label="Close project">
            Close
          </button>
        </div>
      </div>

      {showSuccessDownload && (<ReplicaSuccessDownload scenarioName={displayGenerationJob?.scenarioName ?? item.title} jobId={buildSucceeded ? displayGenerationJob?.id : undefined} specPath={item.specPath} onActionError={onActionError}/>)}

      {compactInitialView && !detailsOpen && !isJobRunning && (<p className="opened-project-compact-hint muted">
          Use <strong>Open folder</strong> to edit files and run dev/tests. Use <strong>View details</strong> for build logs.
        </p>)}

      {showJobDetails && item.analysisJobId && (<div className="opened-project-status-section">
          {analysisPollError && isDesignActive && <p className="error-text">{analysisPollError}</p>}
          {detailsError && !displayAnalysisJob && !displayGenerationJob && <p className="error-text">{detailsError}</p>}
          {displayAnalysisJob ? (isDesignActive ? (<div className="job-layout">
                <div className="step-tracker-panel">
                  <StepTracker title="Design steps" items={toStepTrackerItems(displayAnalysisJob.phases, displayAnalysisJob.logs)}/>
                </div>
                <div className="job-layout-main">
                  <AnalysisStatusPanel job={displayAnalysisJob} generating={generating} onGenerate={onGenerate}/>
                </div>
              </div>) : (<AnalysisStatusPanel job={displayAnalysisJob} generating={generating} onGenerate={onGenerate}/>)) : (isDesignActive ? (<div className="processing-placeholder">
              <span className="spinner"/>
              <p>Starting design — extracting uploads and calling the model…</p>
            </div>) : null)}
        </div>)}

      {showJobDetails && item.generationJobId && (<div className="opened-project-status-section">
          {generationPollError && isBuildActive && <p className="error-text">{generationPollError}</p>}
          {detailsError && !displayGenerationJob && !displayAnalysisJob && <p className="error-text">{detailsError}</p>}
          {displayGenerationJob ? (isBuildActive ? (<div className="job-layout">
                <div className="step-tracker-panel">
                  <StepTracker title="Build steps" items={toStepTrackerItems(displayGenerationJob.steps, displayGenerationJob.logs)}/>
                </div>
                <div className="job-layout-main">
                  <JobStatusPanel job={displayGenerationJob} onActionError={onActionError}/>
                </div>
              </div>) : (<JobStatusPanel job={displayGenerationJob} onActionError={onActionError}/>)) : (isBuildActive ? (<div className="processing-placeholder">
              <span className="spinner"/>
              <p>Starting build — preparing generation pipeline…</p>
            </div>) : null)}
        </div>)}

      {showJobDetails && item.sessionSlug && !item.analysisJobId && !item.generationJobId && item.specPath && (<div className="opened-project-status-section">
          <div className="result-block">
            <h3>Saved draft on disk</h3>
            <p className="muted">Spec saved at <code>{item.detail}</code></p>
          </div>
        </div>)}

      {sessionSlug && folderOpen && (<div ref={folderPanelRef} className="opened-project-folder-section">
          <ProjectFileWorkspace sessionSlug={sessionSlug} preferOutput refreshToken={fileTreeRefreshToken}/>
        </div>)}
    </section>);
}
