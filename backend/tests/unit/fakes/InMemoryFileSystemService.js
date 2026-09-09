import path from 'node:path';
import { err, ok } from '../../../src/shared/Result.js';
import { FileSystemError } from '../../../src/domain/errors/GenerationError.js';
/**
 * A pure in-memory FileSystemService fake, used in unit tests so rules and
 * pipeline steps can be tested without touching the real disk. Every path is
 * normalized so tests don't have to worry about "./x" vs "x" mismatches.
 */
/**
 * @implements {FileSystemService}
 */
export class InMemoryFileSystemService {
    files = new Map();
    seed(filePath, contents) {
        this.files.set(this.normalize(filePath), contents);
    }
    async copyDirectory(sourceDir, destinationDir) {
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
    async readFile(filePath) {
        const normalized = this.normalize(filePath);
        const contents = this.files.get(normalized);
        if (contents === undefined) {
            return err(new FileSystemError(`File not found: "${filePath}"`));
        }
        return ok(contents);
    }
    async writeFile(filePath, contents) {
        this.files.set(this.normalize(filePath), contents);
        return ok(undefined);
    }
    async ensureDirectory() {
        return ok(undefined);
    }
    async listFilesRecursive(dirPath) {
        const normalized = this.normalize(dirPath);
        const matches = [...this.files.keys()].filter((filePath) => filePath.startsWith(`${normalized}/`));
        return ok(matches);
    }
    async exists(targetPath) {
        return this.files.has(this.normalize(targetPath));
    }
    async moveFile(sourcePath, destinationPath) {
        const normalizedSource = this.normalize(sourcePath);
        const contents = this.files.get(normalizedSource);
        if (contents === undefined) {
            return err(new FileSystemError(`File not found: "${sourcePath}"`));
        }
        this.files.delete(normalizedSource);
        this.files.set(this.normalize(destinationPath), contents);
        return ok(undefined);
    }
    async removeDirectory(dirPath) {
        const normalized = this.normalize(dirPath);
        for (const filePath of [...this.files.keys()]) {
            if (filePath.startsWith(`${normalized}/`)) {
                this.files.delete(filePath);
            }
        }
        return ok(undefined);
    }
    async removeFile(filePath) {
        this.files.delete(this.normalize(filePath));
        return ok(undefined);
    }
    normalize(inputPath) {
        return inputPath.split(path.sep).join('/');
    }
}
