/**
 * Extracts an uploaded archive to a real directory on disk, so the rest of
 * the system (which only ever reasons about folders — solution_code,
 * prefilled_code, testcase) never has to know a project arrived as a zip
 * rather than an existing local path.
 * @typedef {object} ArchiveExtractionService
 * @property {(zipFilePath: string, destinationDir: string) => Promise<import('../../shared/Result.js').Result<void, import('../../domain/errors/GenerationError.js').FileSystemError>>} extractZip
 */

export {};
