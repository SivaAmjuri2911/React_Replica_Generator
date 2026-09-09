import { err } from '../../shared/Result.js';
import { FileSystemError } from '../../domain/errors/GenerationError.js';
/**
 * Rewrites only the top-level "name" field of a package.json (or
 * package-lock.json, whose root object also has a "name" field), leaving
 * every dependency, script, and version untouched — enforces the "only the
 * name field changes" rule at the point of mutation rather than relying on
 * callers to be careful.
 */
export async function setPackageJsonName(fileSystem, filePath, newName) {
    const readResult = await fileSystem.readFile(filePath);
    if (!readResult.ok) {
        return err(readResult.error);
    }
    let parsed;
    try {
        parsed = JSON.parse(readResult.value);
    }
    catch (cause) {
        return err(new FileSystemError(`"${filePath}" is not valid JSON`, { filePath, cause }));
    }
    parsed.name = newName;
    return fileSystem.writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`);
}
