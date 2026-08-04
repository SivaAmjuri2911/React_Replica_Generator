export interface ScenarioSummary {
  readonly specPath: string;
  readonly scenarioName: string;
  readonly outputFolderBaseName: string;
  readonly testPrefix: string;
}

/**
 * Lists the scenario specs available to generate from — used by the web UI
 * to populate a picker instead of requiring the caller to know a file path.
 */
export interface ScenarioSpecRepository {
  listAvailable(): Promise<readonly ScenarioSummary[]>;
}
