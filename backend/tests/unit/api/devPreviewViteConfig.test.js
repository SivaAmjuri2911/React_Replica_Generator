import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { DEV_PREVIEW_CONFIG_FILENAME, writeDevPreviewViteConfig } from '../../../src/api/devPreviewViteConfig.js';

describe('devPreviewViteConfig', () => {
    it('writes server.origin into a config overlay instead of unsupported CLI flags', async () => {
        const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'replica-dev-preview-'));
        await fs.writeFile(path.join(projectDir, 'vite.config.js'), `export default { plugins: [] };\n`);

        const overlayPath = await writeDevPreviewViteConfig(projectDir, {
            base: '/api/analysis-sessions/analysis-123/dev-preview/',
            origin: 'https://example.com/api/analysis-sessions/analysis-123/dev-preview',
            host: '127.0.0.1',
            port: 3000,
        });

        expect(path.basename(overlayPath)).toBe(DEV_PREVIEW_CONFIG_FILENAME);
        const contents = await fs.readFile(overlayPath, 'utf8');
        expect(contents).toContain('origin: "https://example.com');
        expect(contents).toContain('https://example.com/api/analysis-sessions/analysis-123/dev-preview');
        expect(contents).not.toContain('--origin');
    });
});
