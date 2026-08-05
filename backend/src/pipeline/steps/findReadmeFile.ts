import path from 'node:path';
import type { FileSystemService } from '../../services/fileSystem/FileSystemService.js';

const README_PATTERN = /^readme\.md$/i;

/**
 * Finds the readme at the root of `projectDir`, regardless of its exact
 * casing (README.md, readme.md, Readme.md, ...). A base project's real
 * filename is whatever its author typed — hardcoding "README.md" works by
 * accident on a case-insensitive local filesystem (Windows, default macOS)
 * and silently breaks on Linux (Render, most CI), where "README.md" and
 * "readme.md" are two different files. Mirrors PromoteTestsToTestcaseStep's
 * pattern-based test-file lookup rather than assuming one exact name.
 */
export async function findReadmeFile(fileSystem: FileSystemService, projectDir: string): Promise<string | undefined> {
  const listResult = await fileSystem.listFilesRecursive(projectDir);
  if (!listResult.ok) {
    return undefined;
  }
  return listResult.value.find(
    (filePath) => path.dirname(filePath) === projectDir && README_PATTERN.test(path.basename(filePath))
  );
}
