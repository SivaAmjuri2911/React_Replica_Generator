import { useState } from 'react';
import { apiClient } from '../api/client.js';

/**
 * @typedef {object} ReplicaSuccessDownloadProps
 * @property {string} scenarioName
 * @property {string|undefined} [jobId] Live build job — preferred when still in memory.
 * @property {string|undefined} [specPath] On-disk output — used after the job ends.
 * @property {(message: string) => void} [onActionError]
 */

/** @param {ReplicaSuccessDownloadProps} props */
export function ReplicaSuccessDownload({ scenarioName, jobId, specPath, onActionError }) {
    const [downloading, setDownloading] = useState(false);
    const canDownload = Boolean(jobId || specPath);

    const handleDownload = async () => {
        if (downloading || !canDownload) {
            return;
        }
        setDownloading(true);
        try {
            const filename = `${scenarioName}.zip`;
            if (jobId) {
                await apiClient.downloadGenerationZip(jobId, filename);
            }
            else if (specPath) {
                await apiClient.downloadOutputFromSpec(specPath, filename);
            }
        }
        catch (error) {
            onActionError?.(error instanceof Error ? error.message : String(error));
        }
        finally {
            setDownloading(false);
        }
    };

    return (<div className="replica-success-banner" role="status">
      <div className="replica-success-banner-text">
        <strong>Replica generated successfully</strong>
        <span className="muted">One zip with 4 folders: prefilled, solution, testcase, and IDE_BASED_CODING.</span>
      </div>
      <button type="button" className="replica-success-download-btn" disabled={!canDownload || downloading} onClick={() => void handleDownload()}>
        {downloading ? 'Preparing…' : 'Download zip'}
      </button>
    </div>);
}
