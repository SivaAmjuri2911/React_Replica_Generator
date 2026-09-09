import { transform } from 'esbuild';
import { RuleViolationError } from '../../domain/errors/GenerationError.js';
const LOADER_BY_EXTENSION = {
    '.jsx': 'jsx',
    '.tsx': 'tsx',
    '.js': 'js',
    '.ts': 'ts',
};
/**
 * Parses every generated source file with esbuild — the exact same parser
 * Vite uses at build/test time — and fails fast, with one clean error per
 * broken file, instead of letting a syntax error surface for the first time
 * as a raw esbuild stack trace inside a wasted `npm install` + `npm test`
 * cycle (see ValidateImportResolutionStep for the sibling check that covers
 * imports pointing at files that don't exist — a different, non-syntax
 * failure mode this step does not catch).
 *
 * Exists because "the model won't make this mistake" has already been
 * proven false twice in one afternoon: a manually-authored file's content
 * began with a literal "--- FILE: path ---" header copied from the prompt,
 * and separately, a display-text replacement ("Bid" -> "Service Request")
 * fired inside a code identifier (the "Bid" in "setBid"), inserting a space
 * and producing invalid JavaScript ("setService Request"). Both are
 * fundamentally different bugs with nothing in common except that neither
 * one parses — which is exactly what this step checks for, without needing
 * to know anything about what specifically went wrong.
 */
/**
 * @implements {PipelineStep}
 */
export class ValidateJavaScriptSyntaxStep {
    name = 'ValidateJavaScriptSyntaxStep';
    fileSystem;
    constructor(fileSystem) {
        this.fileSystem = fileSystem;
    }
    async execute(context) {
        if (!context.solutionCodePath) {
            throw new RuleViolationError(this.name, 'solutionCodePath is not set — TransformSolutionCodeStep must run first');
        }
        const solutionCodePath = context.solutionCodePath;
        const filesResult = await this.fileSystem.listFilesRecursive(solutionCodePath);
        if (!filesResult.ok) {
            throw new RuleViolationError(this.name, `Could not list solution_code files: ${filesResult.error.message}`);
        }
        const offenders = [];
        for (const filePath of filesResult.value) {
            const loader = this.loaderFor(filePath);
            if (!loader) {
                continue;
            }
            const contentResult = await this.fileSystem.readFile(filePath);
            if (!contentResult.ok) {
                continue;
            }
            try {
                await transform(contentResult.value, { loader, logLevel: 'silent' });
            }
            catch (cause) {
                offenders.push(`${filePath}: ${this.summarizeEsbuildError(cause)}`);
            }
        }
        if (offenders.length > 0) {
            throw new RuleViolationError(this.name, `Generated code that isn't valid JavaScript/JSX — this always means a manually-authored file's content or a chained text replacement corrupted the code (e.g. a leftover "--- FILE: path ---" header, or a display-text replacement that also matched inside a variable/function name and broke it). Found:\n${offenders.join('\n')}`);
        }
    }
    loaderFor(filePath) {
        const extension = Object.keys(LOADER_BY_EXTENSION).find((candidate) => filePath.endsWith(candidate));
        return extension ? LOADER_BY_EXTENSION[extension] : undefined;
    }
    summarizeEsbuildError(cause) {
        const errors = cause?.errors;
        if (errors && errors.length > 0) {
            return errors.map((error) => error.text).join('; ');
        }
        return cause instanceof Error ? cause.message : String(cause);
    }
}
