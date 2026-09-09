import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client.js';
const POLL_INTERVAL_MS = 1500;
/** Polls an analysis job's status while it's pending/running, stops once it reaches a terminal state. */
export function useAnalysisJobPolling(jobId) {
    const [job, setJob] = useState(undefined);
    const [error, setError] = useState(undefined);
    const latestJobRef = useRef(undefined);
    useEffect(() => {
        if (!jobId) {
            latestJobRef.current = undefined;
            setJob(undefined);
            setError(undefined);
            return;
        }
        let cancelled = false;
        let timeoutHandle;
        let notFoundAttempts = 0;
        const poll = async () => {
            try {
                const latest = await apiClient.getAnalysisJob(jobId);
                if (cancelled) {
                    return;
                }
                notFoundAttempts = 0;
                latestJobRef.current = latest;
                setJob(latest);
                setError(undefined);
                if (latest.status === 'pending' || latest.status === 'running') {
                    timeoutHandle = setTimeout(poll, POLL_INTERVAL_MS);
                }
            }
            catch (pollError) {
                if (cancelled) {
                    return;
                }
                const message = pollError instanceof Error ? pollError.message : String(pollError);
                const lastJob = latestJobRef.current;
                const isNotFound = message.includes('No job found');
                if (isNotFound) {
                    notFoundAttempts += 1;
                }
                if (isNotFound && lastJob === undefined && notFoundAttempts >= 3) {
                    setError(message);
                    return;
                }
                setError(isNotFound && lastJob !== undefined ? undefined : message);
                const shouldRetry = isNotFound
                    ? lastJob === undefined
                        ? notFoundAttempts < 3
                        : lastJob.status === 'pending' || lastJob.status === 'running'
                    : true;
                if (shouldRetry) {
                    timeoutHandle = setTimeout(poll, POLL_INTERVAL_MS);
                }
            }
        };
        void poll();
        return () => {
            cancelled = true;
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        };
    }, [jobId]);
    return { job, error };
}
