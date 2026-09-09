import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectSessionOutput } from '../../../src/api/services/sessionOutputStatus.js';

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

describe('inspectSessionOutput', () => {
    it('detects testcase and IDE folders under output/', async () => {
        const sessionDir = await makeTempDir('session-');
        await mkdir(path.join(sessionDir, 'output', 'Demo_tests'), { recursive: true });
        await writeFile(path.join(sessionDir, 'output', 'Demo_tests', 'package.json'), '{}');
        await mkdir(path.join(sessionDir, 'output', 'IDE_BASED_CODING'), { recursive: true });
        await writeFile(path.join(sessionDir, 'output', 'IDE_BASED_CODING', 'abc.json'), '{}');

        const status = await inspectSessionOutput(sessionDir, undefined);

        expect(status.hasOutput).toBe(true);
        expect(status.hasTestcase).toBe(true);
        expect(status.hasIdeBasedCoding).toBe(true);
        expect(status.testcaseRelativePath).toBe('output/Demo_tests');
        expect(status.ideBasedCodingRelativePath).toBe('output/IDE_BASED_CODING');
    });
});
