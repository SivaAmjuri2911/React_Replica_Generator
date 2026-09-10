import path from 'node:path';
import { outputPrefilledCodePath, packageName } from '../../domain/models/ScenarioSpec.js';
import { setPackageJsonName } from './packageJsonUtils.js';
import { FileSystemError } from '../../domain/errors/GenerationError.js';
import { isTestFileRelativePath, normalizeTestFileMarkers } from '../../services/scenarioSpecGeneration/baseTestFileUtils.js';

/**
 * prefilled_code starts from the uploaded starter, then receives the same
 * file renames and mechanical text/color replacements as solution_code for
 * any transformable paths that exist in the starter. Manually-authored
 * solution overlays are NOT copied here — SyncPrefilledSeedDataStep later
 * syncs only the seed-data arrays when the starter already had them.
 */
/**
 * @implements {PipelineStep}
 */
export class ScaffoldPrefilledCodeStep {
    name = 'ScaffoldPrefilledCodeStep';
    fileSystem;
    textTransformation;
    logger;
    constructor(fileSystem, textTransformation, logger) {
        this.fileSystem = fileSystem;
        this.textTransformation = textTransformation;
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
        for (const rename of spec.fileRenames) {
            const moveResult = await this.fileSystem.moveFile(
                path.join(destination, rename.fromRelativePath),
                path.join(destination, rename.toRelativePath),
            );
            if (!moveResult.ok) {
                throw moveResult.error;
            }
        }
        const colorReplacements = spec.colorSwaps.map((swap) => ({ from: swap.fromHex, to: swap.toHex }));
        for (const relativePath of spec.transformableRelativePaths) {
            const filePath = path.join(destination, relativePath);
            if (!(await this.fileSystem.exists(filePath))) {
                continue;
            }
            this.logger.debug(`Applying scenario replacements to prefilled file: ${relativePath}`);
            const contentResult = await this.fileSystem.readFile(filePath);
            if (!contentResult.ok) {
                throw contentResult.error;
            }
            const renamed = this.textTransformation.applyReplacements(contentResult.value, spec.textReplacements);
            let transformed = this.textTransformation.applySimultaneousReplacements(renamed, colorReplacements);
            if (isTestFileRelativePath(relativePath)) {
                transformed = normalizeTestFileMarkers(transformed, spec.testPrefix);
            }
            const writeResult = await this.fileSystem.writeFile(filePath, transformed);
            if (!writeResult.ok) {
                throw writeResult.error;
            }
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
