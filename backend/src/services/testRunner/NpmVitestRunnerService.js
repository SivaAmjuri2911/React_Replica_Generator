import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { access } from 'node:fs/promises';
import { err, ok } from '../../shared/Result.js';
import { TestExecutionError } from '../../domain/errors/GenerationError.js';
import { parseVitestSummary } from './parseVitestSummary.js';
import { stopDevServersForProjectDir } from '../../api/devServerRegistry.js';
const execAsync = promisify(exec);
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;
async function hasLockfile(projectDir) {
    try {
        await access(path.join(projectDir, 'package-lock.json'));
        return true;
    }
    catch {
        return false;
    }
}
/**
 * @implements {TestRunnerService}
 */
export class NpmVitestRunnerService {
    logger;
    npmCommand;
    constructor(logger, npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm') {
        this.logger = logger.child('NpmVitestRunnerService');
        this.npmCommand = npmCommand;
    }
    async installDependencies(projectDir) {
        try {
            await stopDevServersForProjectDir(projectDir);
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
        }
        catch (cause) {
            return err(new TestExecutionError(`"npm install" failed in "${projectDir}"`, { projectDir, cause: String(cause) }));
        }
    }
    async runTests(projectDir) {
        let rawOutput = '';
        try {
            // Tried forcing --pool=forks --poolOptions.forks.singleFork to cut memory
            // use on constrained hosts (fewer concurrent jsdom instances). Reverted:
            // verified against a real generated project (TicketManagement_Solution,
            // which passes 48/48 under normal settings) that single-fork mode causes
            // 33/48 tests to fail — same failure count even with testTimeout raised to
            // 30s, so it's not a timing issue, something about running all tests in
            // one shared process breaks test isolation. Not safe to ship.
            const { stdout, stderr, exitCode } = await runVitestInDetachedShell(`${this.npmCommand} test -- --run`, projectDir, MAX_BUFFER_BYTES);
            rawOutput = `${stdout}\n${stderr}`;
            if (exitCode === 0) {
                return ok(parseVitestSummary(rawOutput) ?? { passed: true, totalTests: 0, passedTests: 0, rawOutput });
            }
            const parsed = parseVitestSummary(rawOutput);
            if (parsed) {
                return ok(parsed);
            }
            return err(new TestExecutionError(`"npm test" could not be executed in "${projectDir}"`, {
                projectDir,
                rawOutput,
            }));
        }
        catch (cause) {
            return err(new TestExecutionError(`"npm test" could not be executed in "${projectDir}"`, {
                projectDir,
                cause: String(cause),
            }));
        }
    }
}

/**
 * Vitest must not run as a direct child of `node --watch` (the API dev server) —
 * IPC on process.send() collides with vitest-pool workers on Windows.
 * @param {string} command
 * @param {string} cwd
 * @param {number} maxBuffer
 */
function runVitestInDetachedShell(command, cwd, maxBuffer) {
    return new Promise((resolve, reject) => {
        const env = { ...process.env, CI: 'true' };
        const child = process.platform === 'win32'
            ? spawn('cmd.exe', ['/d', '/s', '/c', command], {
                cwd,
                detached: false,
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
                env,
            })
            : spawn('sh', ['-lc', command], {
                cwd,
                detached: false,
                stdio: ['ignore', 'pipe', 'pipe'],
                env,
            });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (chunk) => {
            stdout += chunk.toString();
            if (stdout.length > maxBuffer) {
                stdout = stdout.slice(-maxBuffer);
            }
        });
        child.stderr?.on('data', (chunk) => {
            stderr += chunk.toString();
            if (stderr.length > maxBuffer) {
                stderr = stderr.slice(-maxBuffer);
            }
        });
        child.on('error', reject);
        child.on('close', (code) => {
            resolve({ stdout, stderr, exitCode: code ?? 1 });
        });
    });
}
