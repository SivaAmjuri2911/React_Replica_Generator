import path from 'node:path';
import { promises as fs } from 'node:fs';
import { outputIdeBasedCodingDir, outputPrefilledCodePath, outputSolutionCodePath, outputTestcasePath, } from '../../domain/models/ScenarioSpec.js';

/**
 * @typedef {object} OutputDeliverablePaths
 * @property {string} prefilledCodePath
 * @property {string} solutionCodePath
 * @property {string} testcasePath
 * @property {string} ideBasedCodingDir
 * @property {string} downloadName
 */

/**
 * @param {import('../../domain/models/ScenarioSpec.js').ScenarioSpec} spec
 * @returns {OutputDeliverablePaths}
 */
export function outputDeliverablePathsFromSpec(spec) {
    return {
        prefilledCodePath: outputPrefilledCodePath(spec),
        solutionCodePath: outputSolutionCodePath(spec),
        testcasePath: outputTestcasePath(spec),
        ideBasedCodingDir: outputIdeBasedCodingDir(spec),
        downloadName: spec.outputFolderBaseName,
    };
}

/**
 * @param {string} directoryPath
 */
async function directoryExists(directoryPath) {
    try {
        const stat = await fs.stat(directoryPath);
        return stat.isDirectory();
    }
    catch {
        return false;
    }
}

/**
 * @param {OutputDeliverablePaths} paths
 */
export async function assertOutputDeliverableReady(paths) {
    const missing = [];
    if (!(await directoryExists(paths.prefilledCodePath))) {
        missing.push(path.basename(paths.prefilledCodePath));
    }
    if (!(await directoryExists(paths.solutionCodePath))) {
        missing.push(path.basename(paths.solutionCodePath));
    }
    if (!(await directoryExists(paths.testcasePath))) {
        missing.push(path.basename(paths.testcasePath));
    }
    if (!(await directoryExists(paths.ideBasedCodingDir))) {
        missing.push('IDE_BASED_CODING');
    }
    if (missing.length > 0) {
        throw new Error(`Output is not ready yet — missing: ${missing.join(', ')}. Run Build first.`);
    }
}

/**
 * Builds the standard deliverable zip: four top-level folders —
 * prefilled_code, solution_code, testcase, and IDE_BASED_CODING.
 *
 * @param {import('./ZipCreationService.js').ZipCreationService} zipCreation
 * @param {OutputDeliverablePaths} paths
 */
export async function buildOutputDeliverableZip(zipCreation, paths) {
    await assertOutputDeliverableReady(paths);

    const entries = [
        { type: 'directory', sourcePath: paths.prefilledCodePath, archiveFolderName: path.basename(paths.prefilledCodePath) },
        { type: 'directory', sourcePath: paths.solutionCodePath, archiveFolderName: path.basename(paths.solutionCodePath) },
        { type: 'directory', sourcePath: paths.testcasePath, archiveFolderName: path.basename(paths.testcasePath) },
        { type: 'directory', sourcePath: paths.ideBasedCodingDir, archiveFolderName: 'IDE_BASED_CODING' },
    ];

    const zip = await zipCreation.zipBundle(entries);
    if (!zip.ok) {
        return { error: zip.error.message };
    }

    return {
        filename: `${paths.downloadName}.zip`,
        buffer: zip.value,
    };
}
