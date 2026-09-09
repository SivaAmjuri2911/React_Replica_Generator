import path from 'node:path';
import { writeSessionMeta } from './sessionOutputStatus.js';

/**
 * @param {string} specPath
 * @param {import('../../domain/models/GeneratedProject.js').GeneratedProject} result
 */
export async function writeGenerationSessionMeta(specPath, result) {
    const sessionDir = path.dirname(specPath);
    await writeSessionMeta(sessionDir, {
        lastBuiltAt: new Date().toISOString(),
        buildArtifacts: {
            prefilledCodePath: path.relative(sessionDir, result.prefilledCodePath).split(path.sep).join('/'),
            solutionCodePath: path.relative(sessionDir, result.solutionCodePath).split(path.sep).join('/'),
            testcasePath: path.relative(sessionDir, result.testcasePath).split(path.sep).join('/'),
            ideBasedCodingJsonPath: path.relative(sessionDir, result.ideBasedCodingJsonPath).split(path.sep).join('/'),
            testCaseCount: result.testCases.length,
        },
    });
}
