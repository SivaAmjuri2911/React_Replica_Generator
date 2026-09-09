import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';

const REFRESH_INTERVAL_MS = 5000;

/**
 * Loads in-memory design/build jobs plus on-disk analysis sessions so the UI
 * can reopen past runs after a refresh (and still show uploads after a backend restart).
 */
export function useRecentJobs() {
    const [analysisJobs, setAnalysisJobs] = useState([]);
    const [generationJobs, setGenerationJobs] = useState([]);
    const [analysisSessions, setAnalysisSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(undefined);

    const refresh = useCallback(async () => {
        try {
            const [analyses, generations, sessions] = await Promise.all([
                apiClient.listAnalysisJobs(),
                apiClient.listGenerationJobs(),
                apiClient.listAnalysisSessions(),
            ]);
            setAnalysisJobs(analyses);
            setGenerationJobs(generations);
            setAnalysisSessions(sessions);
            setError(undefined);
        }
        catch (refreshError) {
            setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
        }
        finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
        const intervalId = setInterval(() => {
            void refresh();
        }, REFRESH_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [refresh]);

    return {
        analysisJobs,
        generationJobs,
        analysisSessions,
        loading,
        error,
        refresh,
    };
}
