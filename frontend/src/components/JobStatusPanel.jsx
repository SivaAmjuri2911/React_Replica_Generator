/**
 * @typedef {object} JobStatusPanelProps
 * @property {import('../types.js').GenerationJob} job
 */

const STATUS_LABEL = {
    pending: 'Queued',
    running: 'Building…',
    succeeded: 'Built',
    failed: 'Failed',
};
/**
 * Informational only — the actual download is one combined zip, not a per-folder link.
 * @param {{label: string, path: string}} props
 */
function OutputRow({ label, path }) {
    return (<>
      <dt>{label}</dt>
      <dd>
        <code>{path}</code>
      </dd>
    </>);
}
/** @param {JobStatusPanelProps} props */
export function JobStatusPanel({ job }) {
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
          <dl>
            <OutputRow label="Starter code (prefilled_code)" path={job.result.prefilledCodePath}/>
            <OutputRow label="Solution code (solution_code)" path={job.result.solutionCodePath}/>
            <OutputRow label="Test suite (testcase)" path={job.result.testcasePath}/>
            <OutputRow label="Platform question file (IDE_BASED_CODING JSON)" path={job.result.ideBasedCodingJsonPath}/>
            <dt>Test cases</dt>
            <dd>{job.result.testCases.length}</dd>
          </dl>
          <a className="download-link download-link-primary" href={`/api/generations/${job.id}/download`} download>
            Download Replica (.zip)
          </a>
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
