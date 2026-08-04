import type { Result } from '../../shared/Result.js';
import type { FileSystemError } from '../../domain/errors/GenerationError.js';

/**
 * Extracts an uploaded archive to a real directory on disk, so the rest of
 * the system (which only ever reasons about folders — solution_code,
 * prefilled_code, testcase) never has to know a project arrived as a zip
 * rather than an existing local path.
 */
export interface ArchiveExtractionService {
  extractZip(zipFilePath: string, destinationDir: string): Promise<Result<void, FileSystemError>>;
}
