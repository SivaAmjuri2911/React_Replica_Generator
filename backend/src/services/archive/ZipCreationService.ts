import type { Result } from '../../shared/Result.js';
import type { FileSystemError } from '../../domain/errors/GenerationError.js';

/**
 * One thing to place inside the combined download archive: either a whole
 * directory's contents (prefilled_code, solution_code, testcase) or a single
 * file (the IDE_BASED_CODING JSON) — each nested under its own top-level
 * folder name inside the archive, so the one zip unpacks into the same four
 * pieces a scenario is made of.
 */
export type ZipBundleEntry =
  | { readonly type: 'directory'; readonly sourcePath: string; readonly archiveFolderName: string }
  | { readonly type: 'file'; readonly sourcePath: string; readonly archiveFolderName: string };

/**
 * Zips generated output on demand for download — the inverse of
 * ArchiveExtractionService. Kept in-memory (Buffer) rather than writing a
 * temp file, since the only caller streams the result straight back in an
 * HTTP response.
 */
export interface ZipCreationService {
  /** Bundles every entry into a single archive, each under its own top-level folder. */
  zipBundle(entries: readonly ZipBundleEntry[]): Promise<Result<Buffer, FileSystemError>>;
}
