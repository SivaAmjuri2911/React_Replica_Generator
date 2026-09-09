/**
 * @typedef {object} ScenarioSummary
 * @property {string} specPath
 * @property {string} scenarioName
 * @property {string} outputFolderBaseName
 * @property {string} testPrefix
 */

/**
 * Lists the scenario specs available to generate from — used by the web UI
 * to populate a picker instead of requiring the caller to know a file path.
 * @typedef {object} ScenarioSpecRepository
 * @property {() => Promise<readonly ScenarioSummary[]>} listAvailable
 */

export {};
