import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it } from 'vitest';
import { AdmZipZipCreationService } from '../../../src/services/archive/AdmZipZipCreationService.js';
import { buildOutputDeliverableZip } from '../../../src/services/archive/buildOutputDeliverableZip.js';

/** @type {string[]} */
const tempDirs = [];

async function makeTempDir(prefix) {
    const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
}

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('buildOutputDeliverableZip', () => {
    it('creates a zip with four top-level output folders', async () => {
        const root = await makeTempDir('output-root-');
        const prefilled = path.join(root, 'Demo');
        const solution = path.join(root, 'Demo_Solution');
        const testcase = path.join(root, 'Demo_tests');
        const ideDir = path.join(root, 'IDE_BASED_CODING');

        await mkdir(prefilled, { recursive: true });
        await mkdir(solution, { recursive: true });
        await mkdir(testcase, { recursive: true });
        await mkdir(ideDir, { recursive: true });
        await writeFile(path.join(prefilled, 'package.json'), '{}');
        await writeFile(path.join(solution, 'package.json'), '{}');
        await writeFile(path.join(testcase, 'package.json'), '{}');
        await writeFile(path.join(ideDir, 'question.json'), '{}');

        const zipCreation = new AdmZipZipCreationService();
        const built = await buildOutputDeliverableZip(zipCreation, {
            prefilledCodePath: prefilled,
            solutionCodePath: solution,
            testcasePath: testcase,
            ideBasedCodingDir: ideDir,
            downloadName: 'Demo',
        });

        expect('error' in built).toBe(false);
        if ('error' in built) {
            return;
        }

        const zip = new AdmZip(built.buffer);
        const entryNames = zip.getEntries().map((entry) => entry.entryName.replace(/\\/g, '/'));
        expect(entryNames.some((name) => name.startsWith('Demo/'))).toBe(true);
        expect(entryNames.some((name) => name.startsWith('Demo_Solution/'))).toBe(true);
        expect(entryNames.some((name) => name.startsWith('Demo_tests/'))).toBe(true);
        expect(entryNames.some((name) => name.startsWith('IDE_BASED_CODING/'))).toBe(true);
        expect(entryNames.some((name) => name.startsWith('output/IDE_BASED_CODING/'))).toBe(false);
    });
});
