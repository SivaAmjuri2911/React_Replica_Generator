/**
 * @typedef {object} AnalysisStatusPanelProps
 * @property {import('../types.js').AnalysisJob} job
 * @property {boolean} generating
 * @property {(specPath: string) => void} onGenerate
 */

const STATUS_LABEL = {
    pending: 'Queued',
    running: 'Designing…',
    succeeded: 'Ready to build',
    failed: 'Failed',
};

/**
 * @typedef {object} DraftResultProps
 * @property {import('../types.js').ScenarioSpecDraftDto} result
 * @property {string} specPath
 * @property {boolean} generating
 * @property {(specPath: string) => void} onGenerate
 */

/** @param {DraftResultProps} props */
function DraftResult({ result, specPath, generating, onGenerate }) {
    return (<div className="result-block result-success">
      <h3>Designed "{result.scenarioName}"</h3>
      <p className="muted">
        Review this before generating — especially the color palette and manually-authored files.
      </p>
      <dl>
        <dt>Test prefix</dt>
        <dd>
          <code>{result.testPrefix}</code>
        </dd>
        <dt>Color changes</dt>
        <dd>{result.colorSwaps.length}</dd>
        <dt>Files being rewritten ({result.transformableRelativePaths.length})</dt>
        <dd>
          <ul className="path-list">
            {result.transformableRelativePaths.map((relativePath) => (<li key={relativePath}>
                <code>{relativePath}</code>
              </li>))}
          </ul>
        </dd>
        <dt>Custom-written files ({result.manuallyAuthoredRelativePaths.length})</dt>
        <dd>
          <ul className="path-list">
            {result.manuallyAuthoredRelativePaths.map((relativePath) => (<li key={relativePath}>
                <code>{relativePath}</code>
              </li>))}
          </ul>
        </dd>
        <dt>Scenario blueprint (spec.json)</dt>
        <dd>
          <code>{specPath}</code>
        </dd>
      </dl>
      <button type="button" disabled={generating} onClick={() => onGenerate(specPath)}>
        {generating ? 'Building your replica…' : 'Build This Replica'}
      </button>
      <p className="muted">
        If the generated solution fails its own tests, the same model gets the real failure and
        revises automatically (up to 3 attempts) before this is reported as failed.
      </p>
    </div>);
}
/** @param {AnalysisStatusPanelProps} props */
export function AnalysisStatusPanel({ job, generating, onGenerate }) {
    return (<div className="job-panel">
      <div className="job-header">
        <h2>{job.scenarioSlug}</h2>
        <span className={`status-badge status-${job.status}`}>{STATUS_LABEL[job.status]}</span>
      </div>

      {job.status === 'succeeded' && job.result && job.specPath && (<DraftResult result={job.result} specPath={job.specPath} generating={generating} onGenerate={onGenerate}/>)}

      {job.status === 'failed' && job.failure && (<div className="result-block result-failure">
          <h3>Couldn't design this scenario</h3>
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
