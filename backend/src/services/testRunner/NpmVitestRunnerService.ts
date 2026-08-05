import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { access } from 'node:fs/promises';
import type { TestRunnerService, TestRunResult } from './TestRunnerService.js';
import { err, ok, type Result } from '../../shared/Result.js';
import { TestExecutionError } from '../../domain/errors/GenerationError.js';
import type { Logger } from '../../logging/Logger.js';
import { parseVitestSummary } from './parseVitestSummary.js';

const execAsync = promisify(exec);
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;

async function hasLockfile(projectDir: string): Promise<boolean> {
  try {
    await access(path.join(projectDir, 'package-lock.json'));
    return true;
  } catch {
    return false;
  }
}

export class NpmVitestRunnerService implements TestRunnerService {
  private readonly logger: Logger;
  private readonly npmCommand: string;

  constructor(logger: Logger, npmCommand: string = process.platform === 'win32' ? 'npm.cmd' : 'npm') {
    this.logger = logger.child('NpmVitestRunnerService');
    this.npmCommand = npmCommand;
  }

  async installDependencies(projectDir: string): Promise<Result<void, TestExecutionError>> {
    try {
      // `npm ci` installs exactly what package-lock.json pins — deterministic, same
      // node_modules shape on every machine — instead of `npm install`'s fresh semver-range
      // resolution, which can drift between environments (different registry state, platform,
      // or npm version) even when package.json hasn't changed at all. That drift is exactly
      // what caused a React 19 project to resolve a broken react/react-dom pairing on Render
      // while installing cleanly on localhost from the same package.json. Only fall back to
      // `npm install` when there's no lockfile to enforce (e.g. a hand-authored base project
      // that never had `npm install` run against it before being zipped up).
      const useCi = await hasLockfile(projectDir);
      const installCommand = useCi ? `${this.npmCommand} ci --include=dev` : `${this.npmCommand} install --include=dev`;
      this.logger.info('Installing dependencies', { projectDir, command: installCommand });
      // --include=dev overrides npm's default of skipping devDependencies when NODE_ENV is
      // "production" — exactly the environment most Node hosting platforms (Render included)
      // set by default for a web service. Every test tool here (vite, vitest,
      // @vitejs/plugin-react, jsdom, @testing-library/*) lives in devDependencies, so without
      // this flag the install reports success while silently installing none of them —
      // surfacing later as a confusing Vite config-load failure instead of a clear "not
      // found" at install time.
      await execAsync(installCommand, { cwd: projectDir, maxBuffer: MAX_BUFFER_BYTES });
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
      // Tried forcing --pool=forks --poolOptions.forks.singleFork to cut memory
      // use on constrained hosts (fewer concurrent jsdom instances). Reverted:
      // verified against a real generated project (TicketManagement_Solution,
      // which passes 48/48 under normal settings) that single-fork mode causes
      // 33/48 tests to fail — same failure count even with testTimeout raised to
      // 30s, so it's not a timing issue, something about running all tests in
      // one shared process breaks test isolation. Not safe to ship.
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
