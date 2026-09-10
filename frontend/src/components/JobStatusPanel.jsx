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
export function JobStatusPanel({ job }) {
    return (<div className="job-panel">
      <div className="job-header">
        <h2>{job.scenarioName}</h2>
        <span className={`status-badge status-${job.status}`}>{STATUS_LABEL[job.status]}</span>
      </div>

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
