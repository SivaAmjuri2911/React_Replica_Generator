import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Loads backend/.env into process.env without overwriting existing variables. */
export function loadEnvFile() {
    const envPath = resolve(BACKEND_ROOT, '.env');
    if (!existsSync(envPath)) {
        return;
    }
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length === 0 || trimmed.startsWith('#')) {
            continue;
        }
        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }
        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim();
        if (key.length > 0 && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}
