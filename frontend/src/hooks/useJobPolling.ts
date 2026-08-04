import { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import type { GenerationJob } from '../types.js';

const POLL_INTERVAL_MS = 1500;

/** Polls a job's status while it's pending/running, stops once it reaches a terminal state. */
export function useJobPolling(jobId: string | undefined): { job: GenerationJob | undefined; error: string | undefined } {
  const [job, setJob] = useState<GenerationJob | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!jobId) {
      setJob(undefined);
      setError(undefined);
      return;
    }

    let cancelled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const poll = async (): Promise<void> => {
      try {
        const latest = await apiClient.getJob(jobId);
        if (cancelled) {
          return;
        }
        setJob(latest);
        setError(undefined);
        if (latest.status === 'pending' || latest.status === 'running') {
          timeoutHandle = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : String(pollError));
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
