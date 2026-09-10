import path from 'node:path';
import { outputPrefilledCodePath, packageName } from '../../domain/models/ScenarioSpec.js';
import { setPackageJsonName } from './packageJsonUtils.js';
import { FileSystemError } from '../../domain/errors/GenerationError.js';

/**
 * prefilled_code stays a byte-for-byte copy of the uploaded starter except for
 * package.json/package-lock.json "name". SyncPrefilledSeedDataStep later
 * replaces leading seed-data arrays when the starter already had them.
 */
/**
 * @implements {PipelineStep}
 */
export class ScaffoldPrefilledCodeStep {
    name = 'ScaffoldPrefilledCodeStep';
    fileSystem;
    logger;
    constructor(fileSystem, logger) {
        this.fileSystem = fileSystem;
        this.logger = logger;
    }
    async execute(context) {
        const { spec } = context;
        const destination = outputPrefilledCodePath(spec);
        const manifestResult = await this.fileSystem.listFilesRecursive(spec.paths.basePrefilledCode);
        if (manifestResult.ok) {
            for (const absoluteFilePath of manifestResult.value) {
                const relativePath = path.relative(spec.paths.basePrefilledCode, absoluteFilePath).split(path.sep).join('/');
                this.logger.debug(`Processing file: ${relativePath}`);
            }
        }
        const copyResult = await this.fileSystem.copyDirectory(spec.paths.basePrefilledCode, destination);
        if (!copyResult.ok) {
            throw copyResult.error;
        }
        const expectedName = packageName(spec);
        await this.renamePackageIfPresent(path.join(destination, 'package.json'), expectedName);
        await this.renamePackageIfPresent(path.join(destination, 'package-lock.json'), expectedName);
        context.prefilledCodePath = destination;
    }
    async renamePackageIfPresent(filePath, expectedName) {
        if (!(await this.fileSystem.exists(filePath))) {
            return;
        }
        const result = await setPackageJsonName(this.fileSystem, filePath, expectedName);
        if (!result.ok) {
            throw new FileSystemError(`Failed to set package name in "${filePath}"`, { cause: result.error });
        }
    }
}
