import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ConfigurationError } from '../domain/errors/GenerationError.js';
const REQUIRED_TOP_LEVEL_FIELDS = [
    'scenarioName',
    'outputFolderBaseName',
    'testPrefix',
    'platformMetadata',
    'paths',
    'textReplacements',
    'fileRenames',
    'colorSwaps',
    'transformableRelativePaths',
    'manuallyAuthoredRelativePaths',
];
/**
 * Loads a ScenarioSpec from a JSON file on disk, resolving every path field
 * relative to the spec file's own directory so specs are portable (a spec
 * can be checked in and moved without hardcoded absolute paths breaking).
 */
export class ScenarioSpecLoader {
    async loadFromFile(specFilePath) {
        const rawContents = await fs.readFile(specFilePath, 'utf8');
        let parsed;
        try {
            parsed = JSON.parse(rawContents);
        }
        catch (cause) {
            throw new ConfigurationError(`Scenario spec at "${specFilePath}" is not valid JSON`, { cause });
        }
        this.assertShape(parsed, specFilePath);
        return this.resolvePaths(parsed, path.dirname(specFilePath));
    }
    assertShape(value, specFilePath) {
        if (typeof value !== 'object' || value === null) {
            throw new ConfigurationError(`Scenario spec at "${specFilePath}" must be a JSON object`);
        }
        const missing = REQUIRED_TOP_LEVEL_FIELDS.filter((field) => !(field in value));
        if (missing.length > 0) {
            throw new ConfigurationError(`Scenario spec at "${specFilePath}" is missing required field(s): ${missing.join(', ')}`);
        }
    }
    resolvePaths(spec, baseDir) {
        const resolve = (candidatePath) => path.isAbsolute(candidatePath) ? candidatePath : path.resolve(baseDir, candidatePath);
        return {
            ...spec,
            paths: {
                basePrefilledCode: resolve(spec.paths.basePrefilledCode),
                baseSolutionCode: resolve(spec.paths.baseSolutionCode),
                baseTestcase: resolve(spec.paths.baseTestcase),
                outputRoot: resolve(spec.paths.outputRoot),
                ideBasedCodingOutputDir: path.join(resolve(spec.paths.outputRoot), 'IDE_BASED_CODING'),
                stagingDir: resolve(spec.paths.stagingDir),
            },
        };
    }
}
