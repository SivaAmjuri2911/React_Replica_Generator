import type { Result } from '../../shared/Result.js';
import type { FileSystemError } from '../../domain/errors/GenerationError.js';

/**
 * Abstraction over all disk access. Every other layer depends on this
 * interface, never on `node:fs` directly — keeps pipeline/services testable
 * with an in-memory fake and keeps the disk implementation swappable.
 */
export interface FileSystemService {
  copyDirectory(sourceDir: string, destinationDir: string): Promise<Result<void, FileSystemError>>;
  readFile(filePath: string): Promise<Result<string, FileSystemError>>;
  writeFile(filePath: string, contents: string): Promise<Result<void, FileSystemError>>;
  ensureDirectory(dirPath: string): Promise<Result<void, FileSystemError>>;
  listFilesRecursive(dirPath: string): Promise<Result<readonly string[], FileSystemError>>;
  exists(path: string): Promise<boolean>;
  moveFile(sourcePath: string, destinationPath: string): Promise<Result<void, FileSystemError>>;
  removeDirectory(dirPath: string): Promise<Result<void, FileSystemError>>;
  removeFile(filePath: string): Promise<Result<void, FileSystemError>>;
}
