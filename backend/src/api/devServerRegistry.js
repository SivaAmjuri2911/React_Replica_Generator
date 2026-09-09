import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * @typedef {object} DevServerEntry
 * @property {string} projectDir Absolute path to the npm project root.
 * @property {string} url
 * @property {number|undefined} pid
 * @property {import('node:child_process').ChildProcess|undefined} [child]
 */

/** @type {Map<string, DevServerEntry>} */
const runningDevServers = new Map();

/** @param {string} key @param {DevServerEntry} entry */
export function registerDevServer(key, entry) {
    runningDevServers.set(key, entry);
}

/** @param {string} key */
export function unregisterDevServer(key) {
    runningDevServers.delete(key);
}

/** @param {string} key */
export function getDevServer(key) {
    return runningDevServers.get(key);
}

/** @param {string} projectDir */
function normalizeProjectDir(projectDir) {
    return path.resolve(projectDir);
}

/**
 * Stops any dev server that was started for this npm project folder so Windows
 * can release locks on files like node_modules/@esbuild/win32-x64/esbuild.exe.
 *
 * @param {string} projectDir
 */
export async function stopDevServersForProjectDir(projectDir) {
    const normalized = normalizeProjectDir(projectDir);
    /** @type {Promise<void>[]} */
    const stops = [];
    for (const [key, entry] of runningDevServers.entries()) {
        if (normalizeProjectDir(entry.projectDir) === normalized) {
            stops.push(stopDevServerEntry(key, entry));
        }
    }
    await Promise.all(stops);
}

/** @param {string} key @param {DevServerEntry} entry */
async function stopDevServerEntry(key, entry) {
    try {
        if (entry.child && !entry.child.killed) {
            entry.child.kill('SIGTERM');
        }
        if (entry.pid && process.platform === 'win32') {
            await execAsync(`taskkill /PID ${entry.pid} /T /F`).catch(() => undefined);
        }
    }
    catch {
        // Best-effort shutdown — install may still succeed once handles are released.
    }
    runningDevServers.delete(key);
    await sleep(750);
}

/** @param {number} ms */
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
