import path from 'node:path';
import { promises as fs } from 'node:fs';
import { migrateLegacyIdeBasedCodingLayout } from '../../config/migrateLegacyIdeBasedCodingLayout.js';
import { outputIdeBasedCodingDir, outputTestcasePath } from '../../domain/models/ScenarioSpec.js';

/**
 * @typedef {object} SessionOutputStatus
 * @property {boolean} hasOutput
 * @property {boolean} hasTestcase
 * @property {boolean} hasIdeBasedCoding
 * @property {string|undefined} testcaseRelativePath
 * @property {string|undefined} ideBasedCodingRelativePath
 */

/**
 * Detects build artifacts under a session folder and normalizes legacy IDE layouts.
 * @param {string} sessionDir
 * @param {import('../../domain/models/ScenarioSpec.js').ScenarioSpec|undefined} spec
 * @returns {Promise<SessionOutputStatus>}
 */
export async function inspectSessionOutput(sessionDir, spec) {
    await migrateLegacyIdeBasedCodingLayout(sessionDir);

    const outputDir = path.join(sessionDir, 'output');
    const hasOutput = await directoryHasEntries(outputDir);

    let hasTestcase = false;
    let hasIdeBasedCoding = false;
    /** @type {string|undefined} */
    let testcaseRelativePath;
    /** @type {string|undefined} */
    let ideBasedCodingRelativePath;

    if (spec) {
        const testcasePath = outputTestcasePath(spec);
        hasTestcase = await directoryHasEntries(testcasePath);
        if (hasTestcase) {
            testcaseRelativePath = path.relative(sessionDir, testcasePath).split(path.sep).join('/');
        }

        const ideDir = outputIdeBasedCodingDir(spec);
        hasIdeBasedCoding = await directoryHasJsonFile(ideDir);
        if (hasIdeBasedCoding) {
            ideBasedCodingRelativePath = path.relative(sessionDir, ideDir).split(path.sep).join('/');
        }
    }
    else {
        const outputEntries = await fs.readdir(outputDir, { withFileTypes: true }).catch(() => []);
        for (const entry of outputEntries) {
            if (entry.isDirectory() && entry.name.endsWith('_tests')) {
                hasTestcase = true;
                testcaseRelativePath = path.posix.join('output', entry.name);
            }
            if (entry.isDirectory() && entry.name === 'IDE_BASED_CODING') {
                const ideDir = path.join(outputDir, entry.name);
                hasIdeBasedCoding = await directoryHasJsonFile(ideDir);
                if (hasIdeBasedCoding) {
                    ideBasedCodingRelativePath = path.posix.join('output', 'IDE_BASED_CODING');
                }
            }
        }
    }

    return {
        hasOutput,
        hasTestcase,
        hasIdeBasedCoding,
        testcaseRelativePath,
        ideBasedCodingRelativePath,
    };
}

/** @param {string} directoryPath */
async function directoryHasEntries(directoryPath) {
    const entries = await fs.readdir(directoryPath).catch(() => []);
    return entries.length > 0;
}

/** @param {string} directoryPath */
async function directoryHasJsonFile(directoryPath) {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true }).catch(() => []);
    return entries.some((entry) => entry.isFile() && entry.name.endsWith('.json'));
}

/**
 * @param {string} sessionDir
 * @param {Record<string, unknown>} patch
 */
export async function writeSessionMeta(sessionDir, patch) {
    const metaPath = path.join(sessionDir, '.session-meta.json');
    /** @type {Record<string, unknown>} */
    let existing = {};
    try {
        const raw = await fs.readFile(metaPath, 'utf8');
        existing = JSON.parse(raw);
    }
    catch {
        // No meta yet.
    }
    const next = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(metaPath, `${JSON.stringify(next, null, 2)}\n`);
}
