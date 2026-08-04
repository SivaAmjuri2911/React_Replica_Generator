import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { ScenarioSpec } from '../domain/models/ScenarioSpec.js';
import { ConfigurationError } from '../domain/errors/GenerationError.js';

const REQUIRED_TOP_LEVEL_FIELDS: readonly (keyof ScenarioSpec)[] = [
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
  async loadFromFile(specFilePath: string): Promise<ScenarioSpec> {
    const rawContents = await fs.readFile(specFilePath, 'utf8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContents);
    } catch (cause) {
      throw new ConfigurationError(`Scenario spec at "${specFilePath}" is not valid JSON`, { cause });
    }

    this.assertShape(parsed, specFilePath);
    return this.resolvePaths(parsed, path.dirname(specFilePath));
  }

  private assertShape(value: unknown, specFilePath: string): asserts value is ScenarioSpec {
    if (typeof value !== 'object' || value === null) {
      throw new ConfigurationError(`Scenario spec at "${specFilePath}" must be a JSON object`);
    }
    const missing = REQUIRED_TOP_LEVEL_FIELDS.filter((field) => !(field in (value as object)));
    if (missing.length > 0) {
      throw new ConfigurationError(
        `Scenario spec at "${specFilePath}" is missing required field(s): ${missing.join(', ')}`
      );
    }
  }

  private resolvePaths(spec: ScenarioSpec, baseDir: string): ScenarioSpec {
    const resolve = (candidatePath: string): string =>
      path.isAbsolute(candidatePath) ? candidatePath : path.resolve(baseDir, candidatePath);

    return {
      ...spec,
      paths: {
        basePrefilledCode: resolve(spec.paths.basePrefilledCode),
        baseSolutionCode: resolve(spec.paths.baseSolutionCode),
        baseTestcase: resolve(spec.paths.baseTestcase),
        ideBasedCodingOutputDir: resolve(spec.paths.ideBasedCodingOutputDir),
        outputRoot: resolve(spec.paths.outputRoot),
        stagingDir: resolve(spec.paths.stagingDir),
      },
    };
  }
}
