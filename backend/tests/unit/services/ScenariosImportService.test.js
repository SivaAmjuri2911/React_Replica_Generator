import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it } from 'vitest';
import { ScenariosImportService } from '../../../src/services/scenarios/ScenariosImportService.js';

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

describe('ScenariosImportService', () => {
    it('imports analysis-* folders from a scenarios/ zip wrapper', async () => {
        const scenariosRoot = await makeTempDir('scenarios-root-');
        const stagingDir = await makeTempDir('staging-');
        const zipPath = path.join(await makeTempDir('zip-'), 'scenarios-import.zip');

        const zip = new AdmZip();
        zip.addFile('scenarios/analysis-abc12345/uploaded/readme.txt', Buffer.from('hello'));
        zip.addFile('scenarios/analysis-abc12345/spec.json', Buffer.from('{"scenarioName":"Demo"}'));
        zip.writeZip(zipPath);

        const service = new ScenariosImportService();
        const result = await service.importFromZip(zipPath, scenariosRoot, stagingDir);

        expect(result.imported).toEqual(['analysis-abc12345']);
        expect(result.skipped).toEqual([]);

        const uploaded = await readFile(path.join(scenariosRoot, 'analysis-abc12345', 'uploaded', 'readme.txt'), 'utf8');
        expect(uploaded).toBe('hello');
    });

    it('imports analysis-* folders from a flat zip layout', async () => {
        const scenariosRoot = await makeTempDir('scenarios-root-');
        const stagingDir = await makeTempDir('staging-');
        const zipPath = path.join(await makeTempDir('zip-'), 'scenarios-import.zip');

        const zip = new AdmZip();
        zip.addFile('analysis-deadbeef/uploaded/readme.txt', Buffer.from('flat'));
        zip.writeZip(zipPath);

        const service = new ScenariosImportService();
        const result = await service.importFromZip(zipPath, scenariosRoot, stagingDir);

        expect(result.imported).toEqual(['analysis-deadbeef']);
        const uploaded = await readFile(path.join(scenariosRoot, 'analysis-deadbeef', 'uploaded', 'readme.txt'), 'utf8');
        expect(uploaded).toBe('flat');
    });

    it('rejects zips with no analysis session folders', async () => {
        const scenariosRoot = await makeTempDir('scenarios-root-');
        const stagingDir = await makeTempDir('staging-');
        const zipPath = path.join(await makeTempDir('zip-'), 'empty.zip');

        const zip = new AdmZip();
        zip.addFile('notes.txt', Buffer.from('nothing useful'));
        zip.writeZip(zipPath);

        const service = new ScenariosImportService();
        await expect(service.importFromZip(zipPath, scenariosRoot, stagingDir)).rejects.toThrow(/analysis-\* project folders/);
    });
});
