import { promises as fs } from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

const ANALYSIS_SLUG_PATTERN = /^analysis-[a-z0-9-]+$/i;

/**
 * Imports analysis-* session folders from a zip produced by pack:scenarios (or any
 * zip whose top level is either analysis-* dirs or a scenarios/ wrapper).
 */
export class ScenariosImportService {
    /**
     * @param {string} zipFilePath
     * @param {string} scenariosRoot
     * @param {string} stagingDir
     */
    async importFromZip(zipFilePath, scenariosRoot, stagingDir) {
        await fs.mkdir(stagingDir, { recursive: true });
        await fs.mkdir(scenariosRoot, { recursive: true });

        try {
            const zip = new AdmZip(zipFilePath);
            zip.extractAllTo(stagingDir, true);
        }
        catch (cause) {
            throw new Error(`Failed to extract import zip: ${cause instanceof Error ? cause.message : String(cause)}`);
        }

        const sessionsRoot = await resolveImportSessionsRoot(stagingDir);
        if (!sessionsRoot) {
            throw new Error('Zip must contain analysis-* project folders (or a scenarios/ folder wrapping them)');
        }

        const entries = await fs.readdir(sessionsRoot, { withFileTypes: true });
        /** @type {string[]} */
        const imported = [];
        /** @type {string[]} */
        const skipped = [];

        for (const entry of entries) {
            if (!entry.isDirectory() || !entry.name.startsWith('analysis-')) {
                continue;
            }
            if (!ANALYSIS_SLUG_PATTERN.test(entry.name)) {
                skipped.push(entry.name);
                continue;
            }

            const sourceDir = path.join(sessionsRoot, entry.name);
            const destinationDir = path.join(scenariosRoot, entry.name);
            assertPathContained(scenariosRoot, destinationDir);
            await fs.cp(sourceDir, destinationDir, { recursive: true, force: true });
            imported.push(entry.name);
        }

        if (imported.length === 0 && skipped.length === 0) {
            throw new Error('No analysis-* project folders were found in the zip');
        }

        return { imported, skipped };
    }
}

/**
 * @param {string} extractedDir
 * @returns {Promise<string|undefined>}
 */
async function resolveImportSessionsRoot(extractedDir) {
    const entries = await fs.readdir(extractedDir, { withFileTypes: true }).catch(() => []);
    if (entries.some((entry) => entry.isDirectory() && entry.name.startsWith('analysis-'))) {
        return extractedDir;
    }

    const scenariosSubdir = path.join(extractedDir, 'scenarios');
    const scenarioEntries = await fs.readdir(scenariosSubdir, { withFileTypes: true }).catch(() => []);
    if (scenarioEntries.some((entry) => entry.isDirectory() && entry.name.startsWith('analysis-'))) {
        return scenariosSubdir;
    }

    if (entries.length === 1 && entries[0]?.isDirectory()) {
        return resolveImportSessionsRoot(path.join(extractedDir, entries[0].name));
    }

    return undefined;
}

/**
 * @param {string} rootDir
 * @param {string} targetPath
 */
function assertPathContained(rootDir, targetPath) {
    const resolvedRoot = path.resolve(rootDir);
    const resolvedTarget = path.resolve(targetPath);
    if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
        throw new Error(`Refusing to write outside scenarios root: "${targetPath}"`);
    }
}

export { ANALYSIS_SLUG_PATTERN };
