import AdmZip from 'adm-zip';
import type { ZipCreationService, ZipBundleEntry } from './ZipCreationService.js';
import { err, ok, type Result } from '../../shared/Result.js';
import { FileSystemError } from '../../domain/errors/GenerationError.js';

/**
 * Install/VCS artifacts, never source. solution_code in particular gets a real
 * `npm install` during ValidateSolutionTestsStep, so without this its download
 * would be a ~100MB / 9500-file archive built entirely in memory — the operator
 * reinstalls from the bundled package-lock.json instead.
 */
const EXCLUDED_DIRECTORY_NAMES = new Set(['node_modules', '.git']);

function isExcluded(archiveRelativePath: string): boolean {
  return archiveRelativePath
    .split(/[\\/]/)
    .some((segment) => EXCLUDED_DIRECTORY_NAMES.has(segment));
}

export class AdmZipZipCreationService implements ZipCreationService {
  async zipBundle(entries: readonly ZipBundleEntry[]): Promise<Result<Buffer, FileSystemError>> {
    try {
      const zip = new AdmZip();
      for (const entry of entries) {
        if (entry.type === 'directory') {
          zip.addLocalFolder(entry.sourcePath, entry.archiveFolderName, (entryPath) => !isExcluded(entryPath));
        } else {
          zip.addLocalFile(entry.sourcePath, entry.archiveFolderName);
        }
      }
      return ok(zip.toBuffer());
    } catch (cause) {
      return err(new FileSystemError('Failed to build combined download zip', { entries, cause }));
    }
  }
}
