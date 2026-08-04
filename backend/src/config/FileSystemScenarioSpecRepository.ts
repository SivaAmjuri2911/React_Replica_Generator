import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { ScenarioSpecRepository, ScenarioSummary } from './ScenarioSpecRepository.js';
import type { ScenarioSpec } from '../domain/models/ScenarioSpec.js';

/**
 * Scans `{scenariosRoot}/*&#47;spec.json` for available scenario specs.
 * Deliberately reads just enough of each file to summarize it (rather than
 * going through the full ScenarioSpecLoader, which resolves absolute paths
 * that the UI doesn't need) — keeps this fast and side-effect free.
 */
export class FileSystemScenarioSpecRepository implements ScenarioSpecRepository {
  private readonly scenariosRoot: string;

  constructor(scenariosRoot: string) {
    this.scenariosRoot = scenariosRoot;
  }

  async listAvailable(): Promise<readonly ScenarioSummary[]> {
    const entries = await fs.readdir(this.scenariosRoot, { withFileTypes: true }).catch(() => []);
    const summaries: ScenarioSummary[] = [];

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

  private async tryReadSummary(specPath: string): Promise<ScenarioSummary | undefined> {
    try {
      const raw = await fs.readFile(specPath, 'utf8');
      const parsed = JSON.parse(raw) as Pick<
        ScenarioSpec,
        'scenarioName' | 'outputFolderBaseName' | 'testPrefix'
      >;
      return {
        specPath,
        scenarioName: parsed.scenarioName,
        outputFolderBaseName: parsed.outputFolderBaseName,
        testPrefix: parsed.testPrefix,
      };
    } catch {
      return undefined;
    }
  }
}
