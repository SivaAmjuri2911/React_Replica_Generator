import path from 'node:path';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';

const LEGACY_DIR_NAME = 'ide_based_coding_output';
const OUTPUT_DIR_NAME = 'output';
const IDE_BASED_CODING_DIR_NAME = 'IDE_BASED_CODING';
const SPEC_IDE_DIR = path.posix.join(OUTPUT_DIR_NAME, IDE_BASED_CODING_DIR_NAME);

/**
 * Normalizes legacy IDE_BASED_CODING layouts to
 * `output/IDE_BASED_CODING/{uuid}.json` and updates spec.json when present.
 * Safe to call repeatedly — no-op when nothing legacy remains.
 *
 * @param {string} sessionDir Absolute path to a scenario or analysis session folder.
 * @returns {Promise<{ migrated: boolean, targetPath?: string }>}
 */
export async function migrateLegacyIdeBasedCodingLayout(sessionDir) {
    let migrated = false;
    /** @type {string | undefined} */
    let targetPath;

    const legacyResult = await migrateLegacyOutputDir(sessionDir);
    if (legacyResult.migrated) {
        migrated = true;
        targetPath = legacyResult.targetPath;
    }

    const flatFileResult = await migrateFlatIdeBasedCodingFile(sessionDir);
    if (flatFileResult.migrated) {
        migrated = true;
        targetPath = flatFileResult.targetPath;
    }

    if (migrated) {
        await updateSpecIdeBasedCodingOutputDir(sessionDir);
    }

    return migrated ? { migrated: true, targetPath } : { migrated: false };
}

/** @param {string} sessionDir */
async function migrateLegacyOutputDir(sessionDir) {
    const legacyDir = path.join(sessionDir, LEGACY_DIR_NAME);
    const targetDir = path.join(sessionDir, OUTPUT_DIR_NAME, IDE_BASED_CODING_DIR_NAME);

    /** @type {string[]} */
    let legacyFiles;
    try {
        const entries = await fs.readdir(legacyDir, { withFileTypes: true });
        legacyFiles = entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
            .map((entry) => path.join(legacyDir, entry.name));
    }
    catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return { migrated: false };
        }
        throw error;
    }

    if (legacyFiles.length === 0) {
        return { migrated: false };
    }

    let latestFile = legacyFiles[0];
    let latestMtime = 0;
    for (const filePath of legacyFiles) {
        const stat = await fs.stat(filePath);
        if (stat.mtimeMs > latestMtime) {
            latestMtime = stat.mtimeMs;
            latestFile = filePath;
        }
    }

    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, path.basename(latestFile));
    await fs.copyFile(latestFile, targetPath);

    for (const filePath of legacyFiles) {
        await fs.unlink(filePath).catch(() => undefined);
    }
    await fs.rmdir(legacyDir).catch(() => undefined);

    return { migrated: true, targetPath };
}

/** @param {string} sessionDir */
async function migrateFlatIdeBasedCodingFile(sessionDir) {
    const flatFilePath = path.join(sessionDir, OUTPUT_DIR_NAME, IDE_BASED_CODING_DIR_NAME);
    let stat;
    try {
        stat = await fs.stat(flatFilePath);
    }
    catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return { migrated: false };
        }
        throw error;
    }

    if (!stat.isFile()) {
        return { migrated: false };
    }

    const raw = await fs.readFile(flatFilePath, 'utf8');
    const questionId = extractQuestionId(raw) ?? randomUUID();
    const targetDir = path.join(sessionDir, OUTPUT_DIR_NAME, `${IDE_BASED_CODING_DIR_NAME}.migrating`);
    const targetPath = path.join(targetDir, `${questionId}.json`);

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetPath, raw);
    await fs.unlink(flatFilePath);
    await fs.rename(targetDir, path.join(sessionDir, OUTPUT_DIR_NAME, IDE_BASED_CODING_DIR_NAME));

    return { migrated: true, targetPath: path.join(sessionDir, OUTPUT_DIR_NAME, IDE_BASED_CODING_DIR_NAME, `${questionId}.json`) };
}

/** @param {string} raw */
function extractQuestionId(raw) {
    try {
        const parsed = JSON.parse(raw);
        const document = Array.isArray(parsed) ? parsed[0] : parsed;
        return typeof document?.question_id === 'string' && document.question_id.length > 0
            ? document.question_id
            : undefined;
    }
    catch {
        return undefined;
    }
}

/** @param {string} sessionDir */
async function updateSpecIdeBasedCodingOutputDir(sessionDir) {
    const specPath = path.join(sessionDir, 'spec.json');
    try {
        const raw = await fs.readFile(specPath, 'utf8');
        const spec = JSON.parse(raw);
        if (!spec.paths || typeof spec.paths !== 'object') {
            return;
        }
        if (spec.paths.ideBasedCodingOutputDir === SPEC_IDE_DIR) {
            return;
        }
        spec.paths.ideBasedCodingOutputDir = SPEC_IDE_DIR;
        await fs.writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`);
    }
    catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return;
        }
        throw error;
    }
}
