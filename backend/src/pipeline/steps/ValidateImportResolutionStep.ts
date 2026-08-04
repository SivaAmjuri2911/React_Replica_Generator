import path from 'node:path';
import type { PipelineStep } from '../PipelineStep.js';
import type { PipelineContext } from '../PipelineContext.js';
import type { FileSystemService } from '../../services/fileSystem/FileSystemService.js';
import { RuleViolationError } from '../../domain/errors/GenerationError.js';

const SOURCE_FILE_PATTERN = /\.(jsx?|tsx?)$/;
const RELATIVE_IMPORT_PATTERN = /(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g;
const RESOLVABLE_EXTENSIONS = ['', '.jsx', '.tsx', '.js', '.ts'];
const INDEX_FILENAMES = ['index.jsx', 'index.tsx', 'index.js', 'index.ts'];

/**
 * Catches the single most common way a generated scenario fails before a
 * single test can even run: a component gets renamed (or a rename collides
 * with another find/replace, e.g. "Vendor" -> "Vendors" firing a second
 * time inside an already-renamed "VendorsPage" and corrupting it into
 * "VendorssPage"), and some import statement elsewhere still references a
 * name that doesn't exist on disk. Previously this surfaced only after a
 * full `npm install` + `npm test` cycle, as a raw esbuild/Vite stack trace
 * inside a generic "npm test could not be executed" error — expensive to
 * reach and unhelpful to act on (see scenarioSpecDraftContract.ts rules 9a
 * and 9b for the prompt-side half of this fix; this is the deterministic
 * backstop, because warning the model not to make this mistake has already
 * proven insufficient twice on real generations).
 *
 * Deliberately a plain PipelineStep, not a GenerationRule run through
 * EnforceRulesStep — that step runs late (after tests, test-case
 * derivation, and IDE JSON generation), whereas this needs to run right
 * after the code exists and BEFORE ValidateSolutionTestsStep pays for an
 * `npm install`/`npm test` cycle that's doomed to fail anyway.
 */
export class ValidateImportResolutionStep implements PipelineStep {
  readonly name = 'ValidateImportResolutionStep';
  private readonly fileSystem: FileSystemService;

  constructor(fileSystem: FileSystemService) {
    this.fileSystem = fileSystem;
  }

  async execute(context: PipelineContext): Promise<void> {
    if (!context.solutionCodePath) {
      throw new RuleViolationError(this.name, 'solutionCodePath is not set — TransformSolutionCodeStep must run first');
    }
    const solutionCodePath = context.solutionCodePath;

    const filesResult = await this.fileSystem.listFilesRecursive(solutionCodePath);
    if (!filesResult.ok) {
      throw new RuleViolationError(this.name, `Could not list solution_code files: ${filesResult.error.message}`);
    }

    const sourceFiles = filesResult.value.filter((filePath) => SOURCE_FILE_PATTERN.test(filePath));
    const offenders: string[] = [];

    for (const filePath of sourceFiles) {
      const contentResult = await this.fileSystem.readFile(filePath);
      if (!contentResult.ok) {
        continue;
      }

      const importPaths = [...contentResult.value.matchAll(RELATIVE_IMPORT_PATTERN)].map((match) => match[1]);
      for (const importPath of importPaths) {
        if (!importPath) {
          continue;
        }
        const resolved = await this.resolveImport(path.dirname(filePath), importPath);
        if (!resolved) {
          offenders.push(`${filePath}: imports "${importPath}" but no matching file exists in solution_code`);
        }
      }
    }

    if (offenders.length > 0) {
      throw new RuleViolationError(
        this.name,
        `A generated file imports something that doesn't exist on disk — almost always a renamed/generated component whose name doesn't exactly match its actual file (a typo, a doubled letter, or a find/replace that fired twice). Every import must resolve to a real file. Found:\n${offenders.join('\n')}`
      );
    }
  }

  private async resolveImport(fromDir: string, importPath: string): Promise<boolean> {
    // path.join, not path.resolve — resolve() would anchor a POSIX-style abstract path (as used
    // throughout this codebase's FileSystemService paths, e.g. "/out/Solution/...") against the
    // current drive root on Windows, silently producing a different absolute path than the one
    // the rest of the pipeline actually uses.
    const resolvedBase = path.join(fromDir, importPath);

    for (const extension of RESOLVABLE_EXTENSIONS) {
      if (await this.fileSystem.exists(`${resolvedBase}${extension}`)) {
        return true;
      }
    }
    for (const indexFilename of INDEX_FILENAMES) {
      if (await this.fileSystem.exists(path.join(resolvedBase, indexFilename))) {
        return true;
      }
    }
    return false;
  }
}
