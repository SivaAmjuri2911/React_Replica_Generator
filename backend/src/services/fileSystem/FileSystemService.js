/**
 * Abstraction over all disk access. Every other layer depends on this
 * interface, never on `node:fs` directly — keeps pipeline/services testable
 * with an in-memory fake and keeps the disk implementation swappable.
 * @typedef {object} FileSystemService
 * @property {(sourceDir: string, destinationDir: string) => Promise<import('../../shared/Result.js').Result<void, import('../../domain/errors/GenerationError.js').FileSystemError>>} copyDirectory
 * @property {(filePath: string) => Promise<import('../../shared/Result.js').Result<string, import('../../domain/errors/GenerationError.js').FileSystemError>>} readFile
 * @property {(filePath: string, contents: string) => Promise<import('../../shared/Result.js').Result<void, import('../../domain/errors/GenerationError.js').FileSystemError>>} writeFile
 * @property {(dirPath: string) => Promise<import('../../shared/Result.js').Result<void, import('../../domain/errors/GenerationError.js').FileSystemError>>} ensureDirectory
 * @property {(dirPath: string) => Promise<import('../../shared/Result.js').Result<readonly string[], import('../../domain/errors/GenerationError.js').FileSystemError>>} listFilesRecursive
 * @property {(path: string) => Promise<boolean>} exists
 * @property {(sourcePath: string, destinationPath: string) => Promise<import('../../shared/Result.js').Result<void, import('../../domain/errors/GenerationError.js').FileSystemError>>} moveFile
 * @property {(dirPath: string) => Promise<import('../../shared/Result.js').Result<void, import('../../domain/errors/GenerationError.js').FileSystemError>>} removeDirectory
 * @property {(filePath: string) => Promise<import('../../shared/Result.js').Result<void, import('../../domain/errors/GenerationError.js').FileSystemError>>} removeFile
 */

export {};
