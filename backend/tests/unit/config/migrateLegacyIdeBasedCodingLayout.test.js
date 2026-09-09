import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { migrateLegacyIdeBasedCodingLayout } from '../../../src/config/migrateLegacyIdeBasedCodingLayout.js';

describe('migrateLegacyIdeBasedCodingLayout', () => {
    it('moves the latest legacy json into output/IDE_BASED_CODING/{uuid}.json and updates spec.json', async () => {
        const sessionDir = path.join(process.cwd(), 'tmp', 'migrate-ide-based-coding-test');
        const legacyDir = path.join(sessionDir, 'ide_based_coding_output');
        await fs.rm(sessionDir, { recursive: true, force: true });
        await fs.mkdir(legacyDir, { recursive: true });

        const olderPath = path.join(legacyDir, 'older-id.json');
        const newerPath = path.join(legacyDir, 'newer-id.json');
        await fs.writeFile(olderPath, '[{"question_id":"old"}]');
        await fs.writeFile(newerPath, '[{"question_id":"new"}]');
        const newerTime = new Date('2026-01-02T00:00:00.000Z');
        const olderTime = new Date('2026-01-01T00:00:00.000Z');
        await fs.utimes(olderPath, olderTime, olderTime);
        await fs.utimes(newerPath, newerTime, newerTime);

        await fs.writeFile(path.join(sessionDir, 'spec.json'), `${JSON.stringify({
            paths: {
                ideBasedCodingOutputDir: 'ide_based_coding_output',
                outputRoot: 'output',
            },
        }, null, 2)}\n`);

        const result = await migrateLegacyIdeBasedCodingLayout(sessionDir);

        expect(result.migrated).toBe(true);
        const targetPath = path.join(sessionDir, 'output', 'IDE_BASED_CODING', 'newer-id.json');
        await expect(fs.readFile(targetPath, 'utf8')).resolves.toContain('"question_id":"new"');
        await expect(fs.stat(legacyDir)).rejects.toMatchObject({ code: 'ENOENT' });

        const spec = JSON.parse(await fs.readFile(path.join(sessionDir, 'spec.json'), 'utf8'));
        expect(spec.paths.ideBasedCodingOutputDir).toBe('output/IDE_BASED_CODING');

        await fs.rm(sessionDir, { recursive: true, force: true });
    });

    it('converts a flat output/IDE_BASED_CODING file into output/IDE_BASED_CODING/{question_id}.json', async () => {
        const sessionDir = path.join(process.cwd(), 'tmp', 'migrate-flat-ide-based-coding-test');
        const outputDir = path.join(sessionDir, 'output');
        const flatFilePath = path.join(outputDir, 'IDE_BASED_CODING');
        await fs.rm(sessionDir, { recursive: true, force: true });
        await fs.mkdir(outputDir, { recursive: true });
        await fs.writeFile(flatFilePath, '[{"question_id":"abc-123"}]');

        const result = await migrateLegacyIdeBasedCodingLayout(sessionDir);

        expect(result.migrated).toBe(true);
        const targetPath = path.join(outputDir, 'IDE_BASED_CODING', 'abc-123.json');
        await expect(fs.readFile(targetPath, 'utf8')).resolves.toContain('"question_id":"abc-123"');
        const migratedDirStat = await fs.stat(flatFilePath);
        expect(migratedDirStat.isDirectory()).toBe(true);

        await fs.rm(sessionDir, { recursive: true, force: true });
    });

    it('is a no-op when no legacy layout exists', async () => {
        const sessionDir = path.join(process.cwd(), 'tmp', 'migrate-ide-based-coding-noop');
        await fs.rm(sessionDir, { recursive: true, force: true });
        await fs.mkdir(sessionDir, { recursive: true });

        const result = await migrateLegacyIdeBasedCodingLayout(sessionDir);

        expect(result.migrated).toBe(false);
        await fs.rm(sessionDir, { recursive: true, force: true });
    });
});
