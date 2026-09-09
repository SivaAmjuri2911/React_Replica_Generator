/**
 * One thing to place inside the combined download archive: either a whole
 * directory's contents (prefilled_code, solution_code, testcase) or a single
 * file (the IDE_BASED_CODING JSON) — each nested under its own top-level
 * folder name inside the archive, so the one zip unpacks into the same four
 * pieces a scenario is made of.
 * @typedef {(
 *   {type: 'directory', sourcePath: string, archiveFolderName: string} |
 *   {type: 'file', sourcePath: string, archiveFolderName: string}
 * )} ZipBundleEntry
 */

/**
 * Zips generated output on demand for download — the inverse of
 * ArchiveExtractionService. Kept in-memory (Buffer) rather than writing a
 * temp file, since the only caller streams the result straight back in an
 * HTTP response.
 * @typedef {object} ZipCreationService
 * @property {(entries: readonly ZipBundleEntry[]) => Promise<import('../../shared/Result.js').Result<Buffer, import('../../domain/errors/GenerationError.js').FileSystemError>>} zipBundle Bundles every entry into a single archive, each under its own top-level folder.
 */

export {};
