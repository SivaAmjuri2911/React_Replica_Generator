import path from 'node:path';
import { FileSystemError } from '../../domain/errors/GenerationError.js';
import {
    findLeadingConstArrayDeclaration,
    replaceLeadingConstArrayDeclaration,
} from './prefilledSeedDataUtils.js';

/**
 * When the uploaded prefilled starter already ships seed data (e.g. App.jsx
 * with a `const articles = [...]` block) but keeps the UI incomplete, copy
 * the transformed data objects from solution_code so both folders expose the
 * same scenario records while prefilled remains a starter skeleton.
 */
/**
 * @implements {PipelineStep}
 */
export class SyncPrefilledSeedDataStep {
    name = 'SyncPrefilledSeedDataStep';
    fileSystem;
    logger;
    constructor(fileSystem, logger) {
        this.fileSystem = fileSystem;
        this.logger = logger;
    }
    async execute(context) {
        if (!context.prefilledCodePath || !context.solutionCodePath) {
            throw new FileSystemError('prefilledCodePath/solutionCodePath are not set — ScaffoldPrefilledCodeStep and TransformSolutionCodeStep must run first');
        }
        const candidatePaths = [...new Set([
            ...context.spec.manuallyAuthoredRelativePaths,
            ...context.spec.transformableRelativePaths,
        ])];
        for (const relativePath of candidatePaths) {
            const prefilledPath = path.join(context.prefilledCodePath, relativePath);
            const solutionPath = path.join(context.solutionCodePath, relativePath);
            if (!(await this.fileSystem.exists(prefilledPath)) || !(await this.fileSystem.exists(solutionPath))) {
                continue;
            }
            const prefilledResult = await this.fileSystem.readFile(prefilledPath);
            const solutionResult = await this.fileSystem.readFile(solutionPath);
            if (!prefilledResult.ok || !solutionResult.ok) {
                throw prefilledResult.ok ? solutionResult.error : prefilledResult.error;
            }
            const prefilledData = findLeadingConstArrayDeclaration(prefilledResult.value);
            if (!prefilledData) {
                continue;
            }
            const solutionData = findLeadingConstArrayDeclaration(solutionResult.value);
            if (!solutionData) {
                continue;
            }
            if (prefilledData.declaration === solutionData.declaration) {
                continue;
            }
            this.logger.debug(`Syncing seed data in prefilled file: ${relativePath}`);
            const synced = replaceLeadingConstArrayDeclaration(prefilledResult.value, solutionData.declaration);
            const writeResult = await this.fileSystem.writeFile(prefilledPath, synced);
            if (!writeResult.ok) {
                throw writeResult.error;
            }
        }
    }
}
