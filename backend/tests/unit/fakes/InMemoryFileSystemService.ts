import path from 'node:path';
import type { FileSystemService } from '../../../src/services/fileSystem/FileSystemService.js';
import { err, ok, type Result } from '../../../src/shared/Result.js';
import { FileSystemError } from '../../../src/domain/errors/GenerationError.js';

/**
 * A pure in-memory FileSystemService fake, used in unit tests so rules and
 * pipeline steps can be tested without touching the real disk. Every path is
 * normalized so tests don't have to worry about "./x" vs "x" mismatches.
 */
export class InMemoryFileSystemService implements FileSystemService {
  private readonly files = new Map<string, string>();

  seed(filePath: string, contents: string): void {
    this.files.set(this.normalize(filePath), contents);
  }

  async copyDirectory(sourceDir: string, destinationDir: string): Promise<Result<void, FileSystemError>> {
    const normalizedSource = this.normalize(sourceDir);
    const normalizedDestination = this.normalize(destinationDir);
    for (const [filePath, contents] of [...this.files.entries()]) {
      if (filePath.startsWith(`${normalizedSource}/`)) {
        const relative = filePath.slice(normalizedSource.length);
        this.files.set(`${normalizedDestination}${relative}`, contents);
      }
    }
    return ok(undefined);
  }

  async readFile(filePath: string): Promise<Result<string, FileSystemError>> {
    const normalized = this.normalize(filePath);
    const contents = this.files.get(normalized);
    if (contents === undefined) {
      return err(new FileSystemError(`File not found: "${filePath}"`));
    }
    return ok(contents);
  }

  async writeFile(filePath: string, contents: string): Promise<Result<void, FileSystemError>> {
    this.files.set(this.normalize(filePath), contents);
    return ok(undefined);
  }

  async ensureDirectory(): Promise<Result<void, FileSystemError>> {
    return ok(undefined);
  }

  async listFilesRecursive(dirPath: string): Promise<Result<readonly string[], FileSystemError>> {
    const normalized = this.normalize(dirPath);
    const matches = [...this.files.keys()].filter((filePath) => filePath.startsWith(`${normalized}/`));
    return ok(matches);
  }

  async exists(targetPath: string): Promise<boolean> {
    return this.files.has(this.normalize(targetPath));
  }

  async moveFile(sourcePath: string, destinationPath: string): Promise<Result<void, FileSystemError>> {
    const normalizedSource = this.normalize(sourcePath);
    const contents = this.files.get(normalizedSource);
    if (contents === undefined) {
      return err(new FileSystemError(`File not found: "${sourcePath}"`));
    }
    this.files.delete(normalizedSource);
    this.files.set(this.normalize(destinationPath), contents);
    return ok(undefined);
  }

  async removeDirectory(dirPath: string): Promise<Result<void, FileSystemError>> {
    const normalized = this.normalize(dirPath);
    for (const filePath of [...this.files.keys()]) {
      if (filePath.startsWith(`${normalized}/`)) {
        this.files.delete(filePath);
      }
    }
    return ok(undefined);
  }

  async removeFile(filePath: string): Promise<Result<void, FileSystemError>> {
    this.files.delete(this.normalize(filePath));
    return ok(undefined);
  }

  private normalize(inputPath: string): string {
    return inputPath.split(path.sep).join('/');
  }
}
