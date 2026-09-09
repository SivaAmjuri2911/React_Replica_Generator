import { useState } from 'react';
import { apiClient } from '../api/client.js';

/**
 * @typedef {object} JobStatusPanelProps
 * @property {import('../types.js').GenerationJob} job
 * @property {(message: string) => void} [onActionError]
 */

const STATUS_LABEL = {
    pending: 'Queued',
    running: 'Building…',
    succeeded: 'Built',
    failed: 'Failed',
};
/** @param {JobStatusPanelProps} props */
export function JobStatusPanel({ job, onActionError }) {
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        if (downloading) {
            return;
        }
        setDownloading(true);
        try {
            await apiClient.downloadGenerationZip(job.id, `${job.scenarioName}.zip`);
        }
        catch (error) {
            onActionError?.(error instanceof Error ? error.message : String(error));
        }
        finally {
            setDownloading(false);
        }
    };

    return (<div className="job-panel">
      <div className="job-header">
        <h2>{job.scenarioName}</h2>
        <span className={`status-badge status-${job.status}`}>{STATUS_LABEL[job.status]}</span>
      </div>

      {job.status === 'succeeded' && job.result && (<div className="result-block result-success">
          <h3>
            Replica built successfully
            {job.attemptsUsed !== undefined && job.attemptsUsed > 1 && (<span className="muted"> (took {job.attemptsUsed} attempts — auto-corrected)</span>)}
          </h3>
          <p className="muted build-output-hint">
            Your zip contains four folders: prefilled code, solution code, testcase, and <code>IDE_BASED_CODING</code>.
          </p>
          <dl>
            <dt>Test cases</dt>
            <dd>{job.result.testCases.length}</dd>
          </dl>
          <button type="button" className="download-link download-link-primary" disabled={downloading} onClick={() => void handleDownload()}>
            {downloading ? 'Preparing download…' : 'Download output (.zip)'}
          </button>
          <p className="muted build-output-hint">Save this zip — it is your final deliverable. The server does not keep projects permanently after deployment.</p>
        </div>)}

      {job.status === 'failed' && job.failure && (<div className="result-block result-failure">
          <h3>Couldn't build this replica</h3>
          <p>
            <strong>{job.failure.code}</strong>
          </p>
          <p>{job.failure.message}</p>
        </div>)}

      <details className="log-panel" open={job.status === 'running'}>
        <summary>Log ({job.logs.length} lines)</summary>
        <pre className="log-lines">
          {job.logs.map((line, index) => (<div key={index} className={`log-line log-${line.level}`}>
              <span className="log-timestamp">{line.timestamp.slice(11, 19)}</span> {line.message}
            </div>))}
        </pre>
      </details>
    </div>);
}
