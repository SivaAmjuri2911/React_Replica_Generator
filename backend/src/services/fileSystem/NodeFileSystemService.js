import { promises as fs } from 'node:fs';
import path from 'node:path';
import { err, ok } from '../../shared/Result.js';
import { FileSystemError } from '../../domain/errors/GenerationError.js';
/**
 * @implements {FileSystemService}
 */
export class NodeFileSystemService {
    logger;
    constructor(logger) {
        this.logger = logger.child('NodeFileSystemService');
    }
    async copyDirectory(sourceDir, destinationDir) {
        try {
            await fs.cp(sourceDir, destinationDir, { recursive: true });
            this.logger.debug('Copied directory', { sourceDir, destinationDir });
            return ok(undefined);
        }
        catch (cause) {
            return err(new FileSystemError(`Failed to copy directory "${sourceDir}" to "${destinationDir}"`, {
                sourceDir,
                destinationDir,
                cause,
            }));
        }
    }
    async readFile(filePath) {
        try {
            const contents = await fs.readFile(filePath, 'utf8');
            return ok(contents);
        }
        catch (cause) {
            return err(new FileSystemError(`Failed to read file "${filePath}"`, { filePath, cause }));
        }
    }
    async writeFile(filePath, contents) {
        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, contents, 'utf8');
            return ok(undefined);
        }
        catch (cause) {
            return err(new FileSystemError(`Failed to write file "${filePath}"`, { filePath, cause }));
        }
    }
    async ensureDirectory(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
            return ok(undefined);
        }
        catch (cause) {
            return err(new FileSystemError(`Failed to create directory "${dirPath}"`, { dirPath, cause }));
        }
    }
    async listFilesRecursive(dirPath) {
        try {
            const results = [];
            await this.walk(dirPath, results);
            return ok(results);
        }
        catch (cause) {
            return err(new FileSystemError(`Failed to list files under "${dirPath}"`, { dirPath, cause }));
        }
    }
    async exists(targetPath) {
        try {
            await fs.access(targetPath);
            return true;
        }
        catch {
            return false;
        }
    }
    async moveFile(sourcePath, destinationPath) {
        try {
            await fs.mkdir(path.dirname(destinationPath), { recursive: true });
            await fs.rename(sourcePath, destinationPath);
            return ok(undefined);
        }
        catch (cause) {
            return err(new FileSystemError(`Failed to move "${sourcePath}" to "${destinationPath}"`, {
                sourcePath,
                destinationPath,
                cause,
            }));
        }
    }
    async removeDirectory(dirPath) {
        try {
            await fs.rm(dirPath, { recursive: true, force: true });
            return ok(undefined);
        }
        catch (cause) {
            return err(new FileSystemError(`Failed to remove directory "${dirPath}"`, { dirPath, cause }));
        }
    }
    async removeFile(filePath) {
        try {
            await fs.rm(filePath, { force: true });
            return ok(undefined);
        }
        catch (cause) {
            return err(new FileSystemError(`Failed to remove file "${filePath}"`, { filePath, cause }));
        }
    }
    static EXCLUDED_DIRECTORY_NAMES = new Set(['node_modules', '.git', 'dist']);
    async walk(currentDir, results) {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && NodeFileSystemService.EXCLUDED_DIRECTORY_NAMES.has(entry.name)) {
                continue;
            }
            const entryPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await this.walk(entryPath, results);
            }
            else {
                results.push(entryPath);
            }
        }
    }
}
