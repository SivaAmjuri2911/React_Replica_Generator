import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { AdmZipZipCreationService } from '../../services/archive/AdmZipZipCreationService.js';
import { ScenariosImportService } from '../../services/scenarios/ScenariosImportService.js';
import { ScenarioSpecLoader } from '../../config/ScenarioSpecLoader.js';
import { inspectSessionOutput } from '../services/sessionOutputStatus.js';
import { buildOutputDeliverableZip, outputDeliverablePathsFromSpec, } from '../../services/archive/buildOutputDeliverableZip.js';
import { migrateLegacyIdeBasedCodingLayout } from '../../config/migrateLegacyIdeBasedCodingLayout.js';
import { getDevServer, registerDevServer, stopDevServersForProjectDir, unregisterDevServer, } from '../devServerRegistry.js';
import { writeDevPreviewViteConfig } from '../devPreviewViteConfig.js';
import { buildDevPreviewPublicPath, buildDevPreviewPublicUrl, isDeployedApi, } from '../publicApiBaseUrl.js';
const ANALYSIS_SLUG_PATTERN = /^analysis-[a-z0-9-]+$/i;
const ZIP_MIME_TYPES = new Set([
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
]);
const SCENARIOS_IMPORT_MAX_BYTES = Number(process.env.SCENARIOS_IMPORT_MAX_BYTES ?? 2 * 1024 * 1024 * 1024);
const EXCLUDED_DIRECTORY_NAMES = new Set(['node_modules', '.git', 'dist', 'build']);
const MAX_FILE_BYTES = 512 * 1024;
const MAX_RUN_OUTPUT_BYTES = 512 * 1024;
const TEXT_FILE_PATTERN = /\.(jsx?|tsx?|json|css|html?|md|txt|xml|ya?ml|env|gitignore|gitattributes)$/i;
const ALLOWED_RUN_SCRIPTS = new Set(['test', 'dev', 'build', 'lint', 'preview']);

/**
 * Lists analysis-* folders on disk so the UI can show uploads and drafts even
 * after the in-memory job store is cleared by a server restart.
 */
function buildScenariosImportUpload(uploadsRoot) {
    const storage = multer.diskStorage({
        destination: uploadsRoot,
        filename: (_request, file, callback) => {
            callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`);
        },
    });
    return multer({
        storage,
        limits: { fileSize: SCENARIOS_IMPORT_MAX_BYTES },
        fileFilter: (_request, file, callback) => {
            if (!file.originalname.toLowerCase().endsWith('.zip') && !ZIP_MIME_TYPES.has(file.mimetype)) {
                callback(new Error(`"${file.originalname}" is not a .zip file`));
                return;
            }
            callback(null, true);
        },
    });
}

export function buildAnalysisSessionRoutes(scenariosRoot, analysisJobService, uploadsRoot, zipCreation = new AdmZipZipCreationService(), scenariosImportService = new ScenariosImportService()) {
    const router = Router();
    const importUpload = buildScenariosImportUpload(uploadsRoot);
    const specLoader = new ScenarioSpecLoader();

    router.get('/analysis-sessions', async (_request, response) => {
        try {
            const entries = await fs.readdir(scenariosRoot, { withFileTypes: true }).catch(() => []);
            const sessions = [];

            for (const entry of entries) {
                if (!entry.isDirectory() || !entry.name.startsWith('analysis-')) {
                    continue;
                }
                const sessionDir = path.join(scenariosRoot, entry.name);
                const specPath = path.join(sessionDir, 'spec.json');
                const uploadedDir = path.join(sessionDir, 'uploaded');
                const stat = await fs.stat(sessionDir).catch(() => undefined);
                const hasUploads = await directoryHasEntries(uploadedDir);
                let scenarioName;
                let hasSpec = false;
                /** @type {import('../../domain/models/ScenarioSpec.js').ScenarioSpec|undefined} */
                let resolvedSpec;

                try {
                    resolvedSpec = await specLoader.loadFromFile(specPath);
                    scenarioName = resolvedSpec.scenarioName;
                    hasSpec = true;
                }
                catch {
                    // No spec yet — upload-only or failed early.
                }

                const outputStatus = await inspectSessionOutput(sessionDir, resolvedSpec);

                if (!hasUploads && !hasSpec && !outputStatus.hasOutput) {
                    continue;
                }

                sessions.push({
                    slug: entry.name,
                    scenarioName,
                    specPath: hasSpec ? specPath : undefined,
                    hasUploads,
                    hasSpec,
                    hasOutput: outputStatus.hasOutput,
                    hasTestcase: outputStatus.hasTestcase,
                    hasIdeBasedCoding: outputStatus.hasIdeBasedCoding,
                    testcaseRelativePath: outputStatus.testcaseRelativePath,
                    ideBasedCodingRelativePath: outputStatus.ideBasedCodingRelativePath,
                    updatedAt: stat?.mtime.toISOString(),
                });
            }

            sessions.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
            response.json({ sessions });
        }
        catch (error) {
            response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
        }
    });

    router.post('/analysis-sessions/import', importUpload.single('scenariosZip'), async (request, response) => {
        const uploadedFile = request.file;
        if (!uploadedFile) {
            response.status(400).json({ error: 'A "scenariosZip" .zip file is required' });
            return;
        }
        const stagingDir = path.join(uploadsRoot, `import-${randomUUID()}`);
        try {
            const result = await scenariosImportService.importFromZip(uploadedFile.path, scenariosRoot, stagingDir);
            response.json(result);
        }
        catch (error) {
            response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
        }
        finally {
            await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
            await fs.rm(uploadedFile.path, { force: true }).catch(() => undefined);
        }
    });

    router.get('/analysis-sessions/:slug/tree', async (request, response) => {
        const slug = request.params.slug;
        if (!ANALYSIS_SLUG_PATTERN.test(slug)) {
            response.status(400).json({ error: 'Invalid analysis session slug' });
            return;
        }
        const sessionDir = path.join(scenariosRoot, slug);
        try {
            await fs.access(sessionDir);
            await migrateLegacyIdeBasedCodingLayout(sessionDir);
            const tree = await buildDirectoryTree(sessionDir, sessionDir);
            response.json({ slug, tree });
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                response.status(404).json({ error: `No saved project found with slug "${slug}"` });
                return;
            }
            response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
        }
    });

    router.get('/analysis-sessions/:slug/files', async (request, response) => {
        const slug = request.params.slug;
        const relativePath = typeof request.query.path === 'string' ? request.query.path : '';
        if (!ANALYSIS_SLUG_PATTERN.test(slug)) {
            response.status(400).json({ error: 'Invalid analysis session slug' });
            return;
        }
        const resolved = resolveSessionRelativePath(scenariosRoot, slug, relativePath);
        if (!resolved.ok) {
            response.status(400).json({ error: resolved.error });
            return;
        }
        try {
            const stat = await fs.stat(resolved.absolutePath);
            if (!stat.isFile()) {
                response.status(400).json({ error: 'Path is not a file' });
                return;
            }
            if (stat.size > MAX_FILE_BYTES) {
                response.status(413).json({ error: `File is too large to preview (${stat.size} bytes)` });
                return;
            }
            const isText = TEXT_FILE_PATTERN.test(resolved.absolutePath) || !path.extname(resolved.absolutePath);
            if (!isText) {
                response.json({
                    path: relativePath.replace(/\\/g, '/'),
                    binary: true,
                    size: stat.size,
                });
                return;
            }
            const content = await fs.readFile(resolved.absolutePath, 'utf8');
            response.json({
                path: relativePath.replace(/\\/g, '/'),
                content,
                size: stat.size,
            });
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                response.status(404).json({ error: `File not found: "${relativePath}"` });
                return;
            }
            response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
        }
    });

    router.put('/analysis-sessions/:slug/files', async (request, response) => {
        const slug = request.params.slug;
        const relativePath = typeof request.body?.path === 'string' ? request.body.path : '';
        const content = typeof request.body?.content === 'string' ? request.body.content : undefined;
        if (!ANALYSIS_SLUG_PATTERN.test(slug)) {
            response.status(400).json({ error: 'Invalid analysis session slug' });
            return;
        }
        if (content === undefined) {
            response.status(400).json({ error: 'Missing file content' });
            return;
        }
        const normalized = relativePath.replace(/\\/g, '/');
        if (normalized.split('/').some((segment) => segment === 'node_modules')) {
            response.status(400).json({ error: 'Cannot edit files inside node_modules' });
            return;
        }
        const resolved = resolveSessionRelativePath(scenariosRoot, slug, relativePath);
        if (!resolved.ok) {
            response.status(400).json({ error: resolved.error });
            return;
        }
        const isText = TEXT_FILE_PATTERN.test(resolved.absolutePath) || !path.extname(resolved.absolutePath);
        if (!isText) {
            response.status(400).json({ error: 'Only text files can be edited' });
            return;
        }
        if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
            response.status(413).json({ error: 'File content is too large to save' });
            return;
        }
        try {
            await fs.mkdir(path.dirname(resolved.absolutePath), { recursive: true });
            await fs.writeFile(resolved.absolutePath, content, 'utf8');
            const stat = await fs.stat(resolved.absolutePath);
            response.json({
                path: normalized,
                size: stat.size,
                saved: true,
            });
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                response.status(404).json({ error: `File not found: "${relativePath}"` });
                return;
            }
            response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
        }
    });

    router.post('/analysis-sessions/:slug/run', async (request, response) => {
        const slug = request.params.slug;
        const relativeDir = typeof request.body?.relativeDir === 'string' ? request.body.relativeDir : '';
        const script = typeof request.body?.script === 'string' ? request.body.script : '';
        if (!ANALYSIS_SLUG_PATTERN.test(slug)) {
            response.status(400).json({ error: 'Invalid analysis session slug' });
            return;
        }
        if (!ALLOWED_RUN_SCRIPTS.has(script)) {
            response.status(400).json({ error: `Unsupported script "${script}"` });
            return;
        }
        const resolved = resolveSessionRelativePath(scenariosRoot, slug, relativeDir);
        if (!resolved.ok) {
            response.status(400).json({ error: resolved.error });
            return;
        }
        try {
            const stat = await fs.stat(resolved.absolutePath);
            if (!stat.isDirectory()) {
                response.status(400).json({ error: 'Run target must be a directory' });
                return;
            }
            const packageJsonPath = path.join(resolved.absolutePath, 'package.json');
            await fs.access(packageJsonPath);
            await ensureDependencies(resolved.absolutePath);
            const normalizedDir = relativeDir.replace(/\\/g, '/');

            if (script === 'dev') {
                const devKey = `${slug}:${normalizedDir}`;
                const existing = getDevServer(devKey);
                if (existing && await isDevServerReady(existing.internalOrigin)) {
                    response.json({
                        script,
                        relativeDir: normalizedDir,
                        mode: 'server',
                        alreadyRunning: true,
                        pid: existing.pid,
                        url: existing.url,
                        stdout: `Dev server already running at ${existing.url}`,
                        stderr: '',
                        exitCode: 0,
                    });
                    return;
                }
                if (existing) {
                    await stopDevServersForProjectDir(resolved.absolutePath);
                }
                const started = await startDevServer(resolved.absolutePath, slug);
                const internalOrigin = `http://127.0.0.1:${started.port}`;
                const previewUrl = buildDevPreviewPublicUrl(slug) ?? started.localUrl;
                registerDevServer(devKey, {
                    pid: started.child.pid,
                    url: previewUrl,
                    internalOrigin,
                    projectDir: resolved.absolutePath,
                    child: started.child,
                });
                started.child.on('exit', () => {
                    unregisterDevServer(devKey);
                });
                response.json({
                    script,
                    relativeDir: normalizedDir,
                    mode: 'server',
                    alreadyRunning: false,
                    pid: started.child.pid,
                    url: previewUrl,
                    stdout: started.stdout,
                    stderr: started.stderr,
                    exitCode: 0,
                });
                return;
            }

            const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
            const command = buildNpmRunCommand(npmCommand, script);
            const result = await runInDetachedShell(command, resolved.absolutePath);
            response.json({
                script,
                relativeDir: normalizedDir,
                mode: 'command',
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
            });
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                response.status(404).json({ error: 'No package.json found in that folder' });
                return;
            }
            response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
        }
    });

    router.get('/analysis-sessions/:slug/download', async (request, response) => {
        const slug = request.params.slug;
        if (!ANALYSIS_SLUG_PATTERN.test(slug)) {
            response.status(400).json({ error: 'Invalid analysis session slug' });
            return;
        }
        const sessionDir = path.join(scenariosRoot, slug);
        try {
            await fs.access(sessionDir);
            const built = await buildSessionDownloadZip(zipCreation, sessionDir, slug, specLoader);
            if ('error' in built) {
                response.status(built.status).json({ error: built.error });
                return;
            }
            response.setHeader('Content-Type', 'application/zip');
            response.setHeader('Content-Disposition', `attachment; filename="${built.filename}"`);
            response.send(built.buffer);
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                response.status(404).json({ error: `No saved project found with slug "${slug}"` });
                return;
            }
            response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
        }
    });

    router.delete('/analysis-sessions/:slug', async (request, response) => {
        const slug = request.params.slug;
        if (!ANALYSIS_SLUG_PATTERN.test(slug)) {
            response.status(400).json({ error: 'Invalid analysis session slug' });
            return;
        }
        const sessionDir = path.join(scenariosRoot, slug);
        try {
            const liveJob = analysisJobService.listJobs().find((job) => job.scenarioSlug === slug);
            if (liveJob) {
                if (liveJob.status === 'pending' || liveJob.status === 'running') {
                    response.status(409).json({ error: 'Cannot delete a project while it is still running' });
                    return;
                }
                await analysisJobService.deleteJob(liveJob.id);
                response.status(204).send();
                return;
            }
            await fs.rm(sessionDir, { recursive: true, force: true });
            response.status(204).send();
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                response.status(404).json({ error: `No saved project found with slug "${slug}"` });
                return;
            }
            response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
        }
    });

    return router;
}

async function directoryHasEntries(directoryPath) {
    const entries = await fs.readdir(directoryPath).catch(() => []);
    return entries.length > 0;
}

/** @param {import('../../services/archive/ZipCreationService.js').ZipCreationService} zipCreation @param {string} sessionDir @param {string} slug @param {ScenarioSpecLoader} specLoader */
async function buildSessionDownloadZip(zipCreation, sessionDir, slug, specLoader) {
    await migrateLegacyIdeBasedCodingLayout(sessionDir);
    const specPath = path.join(sessionDir, 'spec.json');

    try {
        const spec = await specLoader.loadFromFile(specPath);
        const built = await buildOutputDeliverableZip(zipCreation, outputDeliverablePathsFromSpec(spec));
        if ('error' in built) {
            return { error: built.error, status: 500 };
        }
        return built;
    }
    catch (error) {
        return {
            error: error instanceof Error ? error.message : String(error),
            status: 400,
        };
    }
}

/** @param {string} npmCommand @param {string} script */
function buildNpmRunCommand(npmCommand, script) {
    if (script === 'test') {
        // Must pass --run — watch mode breaks when launched from the backend Node process (Vitest IPC conflict).
        return `${npmCommand} run test -- --run`;
    }
    return `${npmCommand} run ${script}`;
}

/** @param {string} nodeModulesDir */
async function hasUsableDevDependencies(nodeModulesDir) {
    const requiredPackages = ['vitest', '@vitejs/plugin-react', 'vite'];
    return (await Promise.all(requiredPackages.map(async (name) => {
        const packageDir = path.join(nodeModulesDir, ...name.split('/'));
        return fs.access(path.join(packageDir, 'package.json')).then(() => true).catch(() => false);
    }))).every(Boolean);
}

/** @param {string} nodeModulesDir @param {number} [attempt] */
async function removeNodeModulesWithRetry(nodeModulesDir, attempt = 0) {
    try {
        await fs.rm(nodeModulesDir, { recursive: true, force: true });
    }
    catch (error) {
        const isLocked = error && typeof error === 'object' && 'code' in error
            && (error.code === 'EPERM' || error.code === 'EBUSY');
        if (isLocked && attempt < 3) {
            await new Promise((resolve) => { setTimeout(resolve, 750 * (attempt + 1)); });
            await removeNodeModulesWithRetry(nodeModulesDir, attempt + 1);
            return;
        }
        throw error;
    }
}

/** @param {string} projectDir */
async function ensureDependencies(projectDir) {
    const nodeModulesDir = path.join(projectDir, 'node_modules');
    if (await hasUsableDevDependencies(nodeModulesDir)) {
        return;
    }

    await stopDevServersForProjectDir(projectDir);

    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const lockfile = path.join(projectDir, 'package-lock.json');
    const hasLockfile = await fs.access(lockfile).then(() => true).catch(() => false);
    const hasNodeModules = await fs.access(nodeModulesDir).then(() => true).catch(() => false);
    const installCommand = hasLockfile && !hasNodeModules
        ? `${npmCommand} ci --include=dev`
        : `${npmCommand} install --include=dev`;

    let installResult = await runInDetachedShell(installCommand, projectDir);
    if (installResult.exitCode === 0 && await hasUsableDevDependencies(nodeModulesDir)) {
        return;
    }

    if (hasNodeModules) {
        await removeNodeModulesWithRetry(nodeModulesDir);
        const reinstallCommand = hasLockfile ? `${npmCommand} ci --include=dev` : `${npmCommand} install --include=dev`;
        installResult = await runInDetachedShell(reinstallCommand, projectDir);
    }

    if (installResult.exitCode !== 0 || !(await hasUsableDevDependencies(nodeModulesDir))) {
        throw new Error(`Could not install dependencies. Close any running dev server for this project and try again.\n${installResult.stderr}\n${installResult.stdout}`.trim());
    }
}

/** @param {string} projectDir */
/**
 * Runs npm in a detached shell so Vitest/Vite don't inherit `node --watch` IPC
 * from the API server process (fixes vitest-pool process.send crashes on Windows).
 * @param {string} command
 * @param {string} cwd
 */
function runInDetachedShell(command, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawnShellProcess(command, cwd, { detached: false, stdioMode: 'pipe' });
        /** @type {string} */
        let stdout = '';
        /** @type {string} */
        let stderr = '';
        child.stdout?.on('data', (chunk) => {
            stdout += chunk.toString();
            if (stdout.length > MAX_RUN_OUTPUT_BYTES) {
                stdout = stdout.slice(-MAX_RUN_OUTPUT_BYTES);
            }
        });
        child.stderr?.on('data', (chunk) => {
            stderr += chunk.toString();
            if (stderr.length > MAX_RUN_OUTPUT_BYTES) {
                stderr = stderr.slice(-MAX_RUN_OUTPUT_BYTES);
            }
        });
        child.on('error', reject);
        child.on('close', (code) => {
            resolve({ stdout, stderr, exitCode: code ?? 1 });
        });
    });
}

/**
 * @param {string} command
 * @param {string} cwd
 * @param {{ detached: boolean, stdioMode: 'ignore'|'pipe' }} options
 */
function spawnShellProcess(command, cwd, options) {
    const env = { ...process.env, CI: 'true' };
    const stdio = options.stdioMode === 'pipe' ? ['ignore', 'pipe', 'pipe'] : 'ignore';
    if (process.platform === 'win32') {
        return spawn('cmd.exe', ['/d', '/s', '/c', command], {
            cwd,
            detached: options.detached,
            stdio,
            windowsHide: true,
            env,
        });
    }
    return spawn('sh', ['-lc', command], {
        cwd,
        detached: options.detached,
        stdio,
        env,
    });
}

/** @param {string} projectDir */
async function readPreferredDevPort(projectDir) {
    const viteConfigPath = path.join(projectDir, 'vite.config.js');
    try {
        const raw = await fs.readFile(viteConfigPath, 'utf8');
        const portMatch = raw.match(/port\s*:\s*(\d+)/);
        if (portMatch) {
            return Number(portMatch[1]);
        }
    }
    catch {
        // Fall back below.
    }
    return 5173;
}

const MAX_DEV_PORT_ATTEMPTS = 50;

/** @param {number} port */
function isPortInUse(port) {
    return new Promise((resolve) => {
        const socket = net.connect({ port, host: '127.0.0.1' });
        const finish = (inUse) => {
            socket.destroy();
            resolve(inUse);
        };
        socket.setTimeout(500);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(true));
        socket.once('error', (error) => {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNREFUSED') {
                finish(false);
                return;
            }
            finish(true);
        });
    });
}

/** @param {number} startPort @param {number} [attempt] */
async function findAvailablePort(startPort, attempt = 0) {
    if (attempt >= MAX_DEV_PORT_ATTEMPTS) {
        throw new Error(`No free port found near ${startPort - attempt}`);
    }
    if (await isPortInUse(startPort)) {
        return findAvailablePort(startPort + 1, attempt + 1);
    }
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.once('error', (error) => {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
                resolve(findAvailablePort(startPort + 1, attempt + 1));
                return;
            }
            reject(error);
        });
        server.listen(startPort, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : startPort;
            server.close(() => resolve(port));
        });
    });
}

/** @param {string} url */
async function isDevServerReady(url) {
    try {
        const response = await fetch(url, { redirect: 'follow' });
        if (!response.ok) {
            return false;
        }
        const html = await response.text();
        return html.includes('id="root"') || html.includes('/@vite/client') || html.includes('vite');
    }
    catch {
        return false;
    }
}

/** @param {string} projectDir @param {string} [sessionSlug] */
async function startDevServer(projectDir, sessionSlug) {
    const preferredPort = await readPreferredDevPort(projectDir);
    const port = await findAvailablePort(preferredPort);
    const localUrl = `http://127.0.0.1:${port}`;
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    let viteArgs = `--host 127.0.0.1 --port ${port} --strictPort`;
    if (isDeployedApi() && sessionSlug) {
        const previewBase = `${buildDevPreviewPublicPath(sessionSlug)}/`;
        const publicOrigin = buildDevPreviewPublicUrl(sessionSlug)?.replace(/\/$/, '') ?? '';
        await writeDevPreviewViteConfig(projectDir, {
            base: previewBase,
            origin: publicOrigin || undefined,
            host: '127.0.0.1',
            port,
        });
        viteArgs += ` --config .replica-dev-preview.mjs`;
    }
    const command = `${npmCommand} run dev -- ${viteArgs}`;
    const child = spawnShellProcess(command, projectDir, { detached: false, stdioMode: 'pipe' });
    /** @type {string} */
    let stdout = '';
    /** @type {string} */
    let stderr = '';

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Dev server did not become ready at ${localUrl} within 45 seconds.\n${stderr}\n${stdout}`.trim()));
        }, 45000);
        const poll = setInterval(() => {
            void isDevServerReady(localUrl).then((ready) => {
                if (ready) {
                    clearTimeout(timeout);
                    clearInterval(poll);
                    resolve(undefined);
                }
            });
        }, 1000);
        child.stdout?.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr?.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('error', (error) => {
            clearTimeout(timeout);
            clearInterval(poll);
            reject(error);
        });
        child.on('exit', (code) => {
            if (code === 0 || code === null) {
                return;
            }
            clearTimeout(timeout);
            clearInterval(poll);
            reject(new Error(`Dev server exited before becoming ready (code ${code}).\n${stderr}\n${stdout}`.trim()));
        });
    });

    child.unref();

    return {
        child,
        port,
        localUrl,
        stdout: `Started dev server at ${localUrl} (pid ${child.pid ?? 'unknown'})`,
        stderr,
    };
}

/**
 * @param {string} scenariosRoot
 * @param {string} slug
 * @param {string} relativePath
 */
function resolveSessionRelativePath(scenariosRoot, slug, relativePath) {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalized.includes('..')) {
        return { ok: false, error: 'Invalid path' };
    }
    const sessionDir = path.resolve(scenariosRoot, slug);
    const absolutePath = path.resolve(sessionDir, normalized || '.');
    if (!absolutePath.startsWith(sessionDir)) {
        return { ok: false, error: 'Invalid path' };
    }
    return { ok: true, absolutePath, sessionDir };
}

/**
 * @param {string} currentDir
 * @param {string} sessionDir
 */
async function buildDirectoryTree(currentDir, sessionDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    /** @type {Array<{name: string, path: string, type: 'file'|'directory', children?: unknown[]}>} */
    const nodes = [];

    const sorted = entries
        .filter((entry) => !entry.name.startsWith('.'))
        .filter((entry) => !(entry.isDirectory() && EXCLUDED_DIRECTORY_NAMES.has(entry.name)))
        .sort((a, b) => {
            if (a.isDirectory() !== b.isDirectory()) {
                return a.isDirectory() ? -1 : 1;
            }
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

    for (const entry of sorted) {
        const absolutePath = path.join(currentDir, entry.name);
        const relativePath = path.relative(sessionDir, absolutePath).replace(/\\/g, '/');
        if (entry.isDirectory()) {
            nodes.push({
                name: entry.name,
                path: relativePath,
                type: 'directory',
                children: await buildDirectoryTree(absolutePath, sessionDir),
            });
        }
        else {
            nodes.push({
                name: entry.name,
                path: relativePath,
                type: 'file',
            });
        }
    }

    return nodes;
}
