import path from 'node:path';
import { promises as fs } from 'node:fs';
/**
 * Scans `{scenariosRoot}/*&#47;spec.json` for available scenario specs.
 * Deliberately reads just enough of each file to summarize it (rather than
 * going through the full ScenarioSpecLoader, which resolves absolute paths
 * that the UI doesn't need) — keeps this fast and side-effect free.
 */
/**
 * @implements {ScenarioSpecRepository}
 */
export class FileSystemScenarioSpecRepository {
    scenariosRoot;
    constructor(scenariosRoot) {
        this.scenariosRoot = scenariosRoot;
    }
    async listAvailable() {
        const entries = await fs.readdir(this.scenariosRoot, { withFileTypes: true }).catch(() => []);
        const summaries = [];
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            const specPath = path.join(this.scenariosRoot, entry.name, 'spec.json');
            const summary = await this.tryReadSummary(specPath);
            if (summary) {
                summaries.push(summary);
            }
        }
        return summaries;
    }
    async tryReadSummary(specPath) {
        try {
            const raw = await fs.readFile(specPath, 'utf8');
            const parsed = JSON.parse(raw);
            return {
                specPath,
                scenarioName: parsed.scenarioName,
                outputFolderBaseName: parsed.outputFolderBaseName,
                testPrefix: parsed.testPrefix,
            };
        }
        catch {
            return undefined;
        }
    }
}
