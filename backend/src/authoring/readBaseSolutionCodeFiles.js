import path from 'node:path';
import { err, ok } from '../shared/Result.js';
import { ConfigurationError } from '../domain/errors/GenerationError.js';
/** Extensions never sent to the model — binary/asset/lockfile noise, not scenario content. */
const EXCLUDED_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.mp4', '.woff', '.woff2', '.ttf', '.eot',
    '.lock',
]);
/** package.json/package-lock.json name fields are rewritten automatically by the pipeline — never
 *  part of a spec's declared lists, so they're excluded from what the model even sees. */
const EXCLUDED_BASENAMES = new Set(['package.json', 'package-lock.json']);
/**
 * Reads every relevant source file under a base solution_code, for handing
 * to an LLM. Shared by ScenarioSpecAuthoringWorkflow (initial draft) and
 * SelfCorrectingScenarioWorkflow (revision requests need the exact same
 * file list the original draft was based on).
 */
export async function readBaseSolutionCodeFiles(fileSystem, baseSolutionCode) {
    const listResult = await fileSystem.listFilesRecursive(baseSolutionCode);
    if (!listResult.ok) {
        return err(listResult.error);
    }
    const files = [];
    for (const filePath of listResult.value) {
        const extension = path.extname(filePath).toLowerCase();
        const basename = path.basename(filePath);
        if (EXCLUDED_EXTENSIONS.has(extension) || EXCLUDED_BASENAMES.has(basename)) {
            continue;
        }
        const contentResult = await fileSystem.readFile(filePath);
        if (!contentResult.ok) {
            return err(contentResult.error);
        }
        const relativePath = path.relative(baseSolutionCode, filePath).split(path.sep).join('/');
        files.push({ relativePath, contents: contentResult.value });
    }
    if (files.length === 0) {
        return err(new ConfigurationError(`No source files found under base solution_code "${baseSolutionCode}"`));
    }
    return ok(files);
}
