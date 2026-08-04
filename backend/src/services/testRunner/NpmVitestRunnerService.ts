import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { TestRunnerService, TestRunResult } from './TestRunnerService.js';
import { err, ok, type Result } from '../../shared/Result.js';
import { TestExecutionError } from '../../domain/errors/GenerationError.js';
import type { Logger } from '../../logging/Logger.js';
import { parseVitestSummary } from './parseVitestSummary.js';

const execAsync = promisify(exec);
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;

export class NpmVitestRunnerService implements TestRunnerService {
  private readonly logger: Logger;
  private readonly npmCommand: string;

  constructor(logger: Logger, npmCommand: string = process.platform === 'win32' ? 'npm.cmd' : 'npm') {
    this.logger = logger.child('NpmVitestRunnerService');
    this.npmCommand = npmCommand;
  }

  async installDependencies(projectDir: string): Promise<Result<void, TestExecutionError>> {
    try {
      this.logger.info('Installing dependencies', { projectDir });
      await execAsync(`${this.npmCommand} install`, { cwd: projectDir, maxBuffer: MAX_BUFFER_BYTES });
      return ok(undefined);
    } catch (cause) {
      return err(
        new TestExecutionError(`"npm install" failed in "${projectDir}"`, { projectDir, cause: String(cause) })
      );
    }
  }

  async runTests(projectDir: string): Promise<Result<TestRunResult, TestExecutionError>> {
    let rawOutput = '';
    try {
      const { stdout, stderr } = await execAsync(`${this.npmCommand} test -- --run`, {
        cwd: projectDir,
        maxBuffer: MAX_BUFFER_BYTES,
      });
      rawOutput = `${stdout}\n${stderr}`;
      return ok(parseVitestSummary(rawOutput) ?? { passed: true, totalTests: 0, passedTests: 0, rawOutput });
    } catch (cause) {
      // Vitest exits non-zero when tests fail — that's a normal outcome we
      // parse, not an infrastructure failure, unless the summary itself is
      // unparsable (which does indicate something actually went wrong).
      const execError = cause as { stdout?: string; stderr?: string };
      rawOutput = `${execError.stdout ?? ''}\n${execError.stderr ?? ''}`;
      const parsed = parseVitestSummary(rawOutput);
      if (parsed) {
        return ok(parsed);
      }
      return err(
        new TestExecutionError(`"npm test" could not be executed in "${projectDir}"`, {
          projectDir,
          rawOutput,
        })
      );
    }
  }
}
