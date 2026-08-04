# replica-generator-web

The web frontend for [`backend`](../backend) — a React UI to trigger and watch generation (and
spec-drafting) runs instead of using the CLI. This is a separate project on purpose: it only talks
to the backend over HTTP (`/api/*`), never imports its code directly, so either side can be run,
deployed, or replaced independently.

## Requires

The backend API server running first — see `../backend/README.md`. This app has nothing to do
without it; every action here is a `fetch()` call to that server.

## Run it

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173` (or the next free port). `vite.config.ts` proxies `/api/*`
requests to `http://localhost:4000`, where the backend must already be listening.

## Structure

```
src/
  types.ts                    Plain DTOs mirroring the backend's domain models (GenerationJob, etc.)
  api/client.ts                 Thin typed fetch wrapper — the only file that knows the API's URL shape
  hooks/
    useJobPolling.ts             Polls a generation job every 1.5s until it reaches succeeded/failed
    useAnalysisJobPolling.ts     Same, for spec-drafting jobs
  components/
    JobStatusPanel.tsx           Status badge, live log panel, result/failure detail
    AnalyzeForm.tsx              Upload form: 3 project zips + a scenario description
    AnalysisStatusPanel.tsx      Drafted spec summary + "Generate from this draft"
  App.tsx                        Wires the above together
```
