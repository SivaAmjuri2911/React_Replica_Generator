import { useState } from 'react';
import { apiClient } from '../api/client.js';
import { resolveSessionSlug } from '../utils/sessionSlug.js';

/** @param {string|undefined} specPath */
function sessionSlugFromSpecPath(specPath) {
    if (!specPath) {
        return undefined;
    }
    return resolveSessionSlug({ specPath });
}

/**
 * @typedef {object} RecentProjectItem
 * @property {string} id
 * @property {'Design'|'Build'|'Saved draft'|'Uploads'} kind
 * @property {string} title
 * @property {string|undefined} when
 * @property {string} label
 * @property {string} status
 * @property {string} detail
 * @property {string|undefined} specPath
 * @property {string|undefined} sessionSlug
 * @property {string|undefined} analysisJobId
 * @property {string|undefined} generationJobId
 * @property {boolean} isRunning
 */

/**
 * @typedef {object} RecentJobsPanelProps
 * @property {readonly import('../types.js').AnalysisJob[]} analysisJobs
 * @property {readonly import('../types.js').GenerationJob[]} generationJobs
 * @property {readonly import('../api/client.js').AnalysisSessionSummary[]} analysisSessions
 * @property {string|undefined} openedProjectId
 * @property {string|undefined} deletingProjectId
 * @property {boolean} loading
 * @property {string|undefined} error
 * @property {(item: RecentProjectItem) => void} onOpenProject
 * @property {(item: RecentProjectItem) => void} onDeleteProject
 * @property {(message: string) => void} [onActionError]
 * @property {(specPath: string) => void} onBuildFromSpec
 * @property {() => void | Promise<void>} [onProjectsImported]
 */

const STATUS_LABEL = {
    pending: 'Queued',
    running: 'Running',
    succeeded: 'Done',
    failed: 'Failed',
};

/** @param {string|undefined} iso */
function formatWhen(iso) {
    if (!iso) {
        return '—';
    }
    return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/** @param {string} specPath */
function formatSpecPath(specPath) {
    const normalized = specPath.replace(/\\/g, '/');
    const marker = '/scenarios/';
    const index = normalized.lastIndexOf(marker);
    return index >= 0 ? normalized.slice(index + marker.length) : normalized;
}

/** @param {import('../types.js').AnalysisJob} job */
function analysisJobToRecentItem(job) {
    return {
        id: `design-${job.id}`,
        kind: 'Design',
        title: job.result?.scenarioName ?? job.scenarioSlug,
        when: job.startedAt,
        label: STATUS_LABEL[job.status],
        status: job.status,
        detail: job.scenarioSlug,
        specPath: job.specPath,
        sessionSlug: job.scenarioSlug,
        analysisJobId: job.id,
        generationJobId: undefined,
        isRunning: job.status === 'pending' || job.status === 'running',
    };
}

/** @param {import('../types.js').GenerationJob} job */
function generationJobToRecentItem(job) {
    return {
        id: `build-${job.id}`,
        kind: 'Build',
        title: job.scenarioName,
        when: job.startedAt,
        label: STATUS_LABEL[job.status],
        status: job.status,
        detail: formatSpecPath(job.specPath),
        specPath: job.specPath,
        sessionSlug: sessionSlugFromSpecPath(job.specPath),
        analysisJobId: undefined,
        generationJobId: job.id,
        isRunning: job.status === 'pending' || job.status === 'running',
    };
}

/**
 * Resolves the opened project immediately — including brand-new jobs that
 * haven't appeared in the recent list yet (fixes missing processing UI).
 */
export function resolveOpenedProject(openedProjectId, recentProjectItems, analysisJob, generationJob) {
    if (!openedProjectId) {
        return undefined;
    }
    const fromList = recentProjectItems.find((item) => item.id === openedProjectId);
    if (fromList) {
        return fromList;
    }
    if (openedProjectId.startsWith('design-')) {
        const jobId = openedProjectId.slice('design-'.length);
        if (analysisJob?.id === jobId) {
            return analysisJobToRecentItem(analysisJob);
        }
        return {
            id: openedProjectId,
            kind: 'Design',
            title: 'Designing scenario…',
            when: undefined,
            label: STATUS_LABEL.running,
            status: 'running',
            detail: 'Processing your upload',
            specPath: undefined,
            sessionSlug: undefined,
            analysisJobId: jobId,
            generationJobId: undefined,
            isRunning: true,
        };
    }
    if (openedProjectId.startsWith('build-')) {
        const jobId = openedProjectId.slice('build-'.length);
        if (generationJob?.id === jobId) {
            return generationJobToRecentItem(generationJob);
        }
        return {
            id: openedProjectId,
            kind: 'Build',
            title: 'Building replica…',
            when: undefined,
            label: STATUS_LABEL.running,
            status: 'running',
            detail: 'Running generation pipeline',
            specPath: undefined,
            sessionSlug: undefined,
            analysisJobId: undefined,
            generationJobId: jobId,
            isRunning: true,
        };
    }
    return undefined;
}

/** @param {RecentJobsPanelProps} props */
export function buildRecentProjectItems({ analysisJobs, generationJobs, analysisSessions, }) {
    /** @type {RecentProjectItem[]} */
    const items = [];

    for (const job of analysisJobs) {
        items.push(analysisJobToRecentItem(job));
    }

    for (const job of generationJobs) {
        items.push(generationJobToRecentItem(job));
    }

    const archivedSessions = analysisSessions.filter((session) => !analysisJobs.some((job) => job.scenarioSlug === session.slug));
    for (const session of archivedSessions) {
        const isBuilt = Boolean(session.hasTestcase && session.hasIdeBasedCoding);
        items.push({
            id: `session-${session.slug}`,
            kind: isBuilt ? 'Build' : session.hasSpec ? 'Saved draft' : 'Uploads',
            title: session.scenarioName ?? session.slug,
            when: session.updatedAt,
            label: isBuilt ? 'Built' : session.hasSpec ? 'Draft saved' : 'Uploads only',
            status: isBuilt || session.hasSpec ? 'succeeded' : 'pending',
            detail: isBuilt
                ? `${session.slug}/output`
                : session.hasSpec
                    ? formatSpecPath(session.specPath ?? session.slug)
                    : `${session.slug}/uploaded`,
            specPath: session.specPath,
            sessionSlug: session.slug,
            analysisJobId: undefined,
            generationJobId: undefined,
            isRunning: false,
        });
    }

    return items.sort((a, b) => (b.when ?? '').localeCompare(a.when ?? ''));
}

/**
 * @param {{
 *   item: RecentProjectItem,
 *   selected: boolean,
 *   deleting: boolean,
 *   onOpenProject: (item: RecentProjectItem) => void,
 *   onDeleteProject: (item: RecentProjectItem) => void,
 *   onBuildFromSpec: (specPath: string) => void,
 * }} props
 */
function RecentProjectCard({ item, selected, deleting, onOpenProject, onDeleteProject, onBuildFromSpec, onActionError }) {
    const sessionSlug = resolveSessionSlug(item);
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        if (!sessionSlug || downloading) {
            return;
        }
        setDownloading(true);
        try {
            if (item.specPath && item.kind === 'Build') {
                await apiClient.downloadOutputFromSpec(item.specPath, `${item.title}.zip`);
            }
            else {
                await apiClient.downloadSessionZip(sessionSlug, `${item.title}.zip`);
            }
        }
        catch (error) {
            onActionError?.(error instanceof Error ? error.message : String(error));
        }
        finally {
            setDownloading(false);
        }
    };

    return (<li className={`recent-project-card ${selected ? 'recent-project-card-selected' : ''}`}>
      <div className="project-surface recent-project-card-shell">
        <div className="recent-project-card-body">
          <span className="recent-project-card-top">
            <span className="project-kind-badge">{item.kind}</span>
            <span className={`status-badge status-${item.status}`}>{item.label}</span>
          </span>
          <strong className="recent-project-card-title">{item.title}</strong>
          <span className="recent-project-card-meta muted">{item.detail}</span>
          <span className="recent-project-card-time muted">{formatWhen(item.when)}</span>
        </div>
        <div className="recent-project-card-actions">
          <button type="button" className="project-action-btn project-action-btn-primary" disabled={deleting} onClick={() => onOpenProject(item)}>
            Open
          </button>
          {sessionSlug
            ? (<button type="button" className="project-action-btn" disabled={downloading || deleting} onClick={() => void handleDownload()}>
                {downloading ? 'Downloading…' : 'Download'}
              </button>)
            : (<span className="project-action-btn project-action-btn-disabled" aria-disabled="true">Download</span>)}
          <button type="button" className="project-action-btn" disabled={!item.specPath || deleting || item.isRunning} onClick={() => item.specPath && onBuildFromSpec(item.specPath)}>
            Build
          </button>
          <button type="button" className="project-action-btn project-action-btn-danger" disabled={deleting || item.isRunning} onClick={() => onDeleteProject(item)} aria-label={`Delete ${item.title}`}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </li>);
}

/** @param {RecentJobsPanelProps} props */
export function RecentJobsPanel({ analysisJobs, generationJobs, analysisSessions, openedProjectId, deletingProjectId, loading, error, onOpenProject, onDeleteProject, onBuildFromSpec, onActionError, onProjectsImported, }) {
    const items = buildRecentProjectItems({ analysisJobs, generationJobs, analysisSessions });
    const [importing, setImporting] = useState(false);
    const [importMessage, setImportMessage] = useState(undefined);
    const [importError, setImportError] = useState(undefined);

    async function handleImportFileChange(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) {
            return;
        }
        setImporting(true);
        setImportMessage(undefined);
        setImportError(undefined);
        try {
            const result = await apiClient.importAnalysisSessions(file);
            const importedCount = result.imported?.length ?? 0;
            const skippedCount = result.skipped?.length ?? 0;
            const skippedNote = skippedCount > 0 ? ` (${skippedCount} skipped)` : '';
            setImportMessage(`Imported ${importedCount} project${importedCount === 1 ? '' : 's'}${skippedNote}.`);
            if (onProjectsImported) {
                await onProjectsImported();
            }
        }
        catch (importFailure) {
            const message = importFailure instanceof Error ? importFailure.message : String(importFailure);
            setImportError(message);
            onActionError?.(message);
        }
        finally {
            setImporting(false);
        }
    }

    return (<section className="project-surface recent-projects-section">
      <div className="recent-projects-header">
        <div className="recent-projects-header-row">
          <div>
            <h2>All Projects</h2>
            <p className="muted">Open a project to edit files and run dev/tests. Active design/build progress appears on New Design.</p>
          </div>
          <label className="project-action-btn project-action-btn-primary scenarios-import-btn">
            {importing ? 'Importing…' : 'Import projects'}
            <input className="scenarios-import-input" type="file" accept=".zip,application/zip" disabled={importing} onChange={(event) => {
                void handleImportFileChange(event);
            }}/>
          </label>
        </div>
        <p className="muted scenarios-import-hint">
          After Build finishes, download the output zip — it contains four folders (prefilled, solution, testcase, IDE_BASED_CODING). Save it locally; the deployed server does not keep projects permanently.
        </p>
        {importMessage && <p className="success-text">{importMessage}</p>}
        {importError && <p className="error-text">{importError}</p>}
      </div>

      {loading && <p className="muted">Loading recent projects…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && items.length === 0 && !error && (<p className="muted">Your uploads and drafts will appear here after you run a design.</p>)}

      {!loading && items.length > 0 && (<ul className="recent-projects-grid">
          {items.map((item) => (<RecentProjectCard key={item.id} item={item} selected={openedProjectId === item.id} deleting={deletingProjectId === item.id} onOpenProject={onOpenProject} onDeleteProject={onDeleteProject} onBuildFromSpec={onBuildFromSpec} onActionError={onActionError}/>))}
        </ul>)}
    </section>);
}
