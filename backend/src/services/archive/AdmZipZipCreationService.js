import AdmZip from 'adm-zip';
import { err, ok } from '../../shared/Result.js';
import { FileSystemError } from '../../domain/errors/GenerationError.js';
/**
 * Install/VCS artifacts, never source. solution_code in particular gets a real
 * `npm install` during ValidateSolutionTestsStep, so without this its download
 * would be a ~100MB / 9500-file archive built entirely in memory — the operator
 * reinstalls from the bundled package-lock.json instead.
 */
const EXCLUDED_DIRECTORY_NAMES = new Set(['node_modules', '.git']);
function isExcluded(archiveRelativePath) {
    return archiveRelativePath
        .split(/[\\/]/)
        .some((segment) => EXCLUDED_DIRECTORY_NAMES.has(segment));
}
/**
 * @implements {ZipCreationService}
 */
export class AdmZipZipCreationService {
    async zipBundle(entries) {
        try {
            const zip = new AdmZip();
            for (const entry of entries) {
                if (entry.type === 'directory') {
                    zip.addLocalFolder(entry.sourcePath, entry.archiveFolderName, (entryPath) => !isExcluded(entryPath));
                }
                else {
                    zip.addLocalFile(entry.sourcePath, entry.archiveFolderName);
                }
            }
            return ok(zip.toBuffer());
        }
        catch (cause) {
            return err(new FileSystemError('Failed to build combined download zip', { entries, cause }));
        }
    }
}
