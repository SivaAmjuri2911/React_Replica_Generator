import { useState } from 'react';
import { apiClient } from '../api/client.js';
import { ProjectFileWorkspace } from './ProjectFileWorkspace.jsx';
import { resolveSessionSlug } from '../utils/sessionSlug.js';

/**
 * @typedef {object} ProjectEditorPageProps
 * @property {import('./RecentJobsPanel.jsx').RecentProjectItem} item
 * @property {() => void} onBack
 * @property {(specPath: string) => void} onGenerate
 * @property {boolean} generating
 * @property {(message: string) => void} [onActionError]
 * @property {number} [fileTreeRefreshToken]
 */

/** @param {ProjectEditorPageProps} props */
export function ProjectEditorPage({ item, onBack, onGenerate, generating, onActionError, fileTreeRefreshToken = 0 }) {
    const sessionSlug = resolveSessionSlug(item);
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        if (!sessionSlug || downloading) {
            return;
        }
        setDownloading(true);
        try {
            await apiClient.downloadSessionZip(sessionSlug, `${item.title}.zip`);
        }
        catch (error) {
            onActionError?.(error instanceof Error ? error.message : String(error));
        }
        finally {
            setDownloading(false);
        }
    };

    return (<section className="project-editor-page">
      <header className="project-editor-header">
        <button type="button" className="project-action-btn project-editor-back" onClick={onBack}>
          ← All Projects
        </button>
        <div className="project-editor-title-block">
          <span className="opened-project-panel-top">
            <span className="project-kind-badge">{item.kind}</span>
            <span className={`status-badge status-${item.status}`}>{item.label}</span>
          </span>
          <h2>{item.title}</h2>
          <p className="muted">{item.detail}</p>
        </div>
        <div className="project-editor-header-actions">
          {sessionSlug && (<button type="button" className="project-action-btn project-editor-action-btn" disabled={downloading} onClick={() => void handleDownload()}>
              {downloading ? 'Downloading…' : 'Download zip'}
            </button>)}
          {item.specPath && (<button type="button" className="project-action-btn project-action-btn-primary" disabled={generating || item.isRunning} onClick={() => onGenerate(item.specPath)}>
              {generating ? 'Building…' : 'Build'}
            </button>)}
        </div>
      </header>

      {sessionSlug ? (<ProjectFileWorkspace sessionSlug={sessionSlug} preferOutput fullPage refreshToken={fileTreeRefreshToken}/>) : (<div className="project-editor-empty">
          <p className="muted">No project files on disk yet.</p>
          {item.specPath && (<button type="button" className="project-action-btn project-action-btn-primary" disabled={generating} onClick={() => onGenerate(item.specPath)}>
              {generating ? 'Building…' : 'Build project'}
            </button>)}
        </div>)}
    </section>);
}
