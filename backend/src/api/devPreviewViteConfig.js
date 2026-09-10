import path from 'node:path';
import { promises as fs } from 'node:fs';

const VITE_CONFIG_CANDIDATES = ['vite.config.js', 'vite.config.mjs', 'vite.config.ts'];
export const DEV_PREVIEW_CONFIG_FILENAME = '.replica-dev-preview.mjs';

/**
 * @param {string} projectDir
 */
async function findViteConfigFileName(projectDir) {
    for (const name of VITE_CONFIG_CANDIDATES) {
        try {
            await fs.access(path.join(projectDir, name));
            return name;
        }
        catch {
            // try next candidate
        }
    }
    return undefined;
}

/**
 * Writes a short-lived Vite config overlay for deployed dev-preview proxying.
 * server.origin is config-only — it is not a supported Vite CLI flag.
 *
 * @param {string} projectDir
 * @param {{ base: string, origin?: string, host: string, port: number }} options
 */
export async function writeDevPreviewViteConfig(projectDir, options) {
    const viteConfigName = await findViteConfigFileName(projectDir);
    const overlayPath = path.join(projectDir, DEV_PREVIEW_CONFIG_FILENAME);
    const originLine = options.origin
        ? `origin: ${JSON.stringify(options.origin)},`
        : '';
    const importBlock = viteConfigName
        ? `try {
  const loaded = await import(${JSON.stringify(`./${viteConfigName}`)});
  baseConfig = loaded.default ?? loaded;
  if (typeof baseConfig === 'function') {
    baseConfig = await baseConfig({ mode: 'development', command: 'serve' });
  }
} catch {
  // Fall back to overlay-only when the base config cannot be loaded (e.g. TypeScript).
}`
        : '';
    const content = `import { mergeConfig } from 'vite';

/** @type {import('vite').UserConfig} */
const overlay = {
  base: ${JSON.stringify(options.base)},
  server: {
    host: ${JSON.stringify(options.host)},
    port: ${options.port},
    strictPort: true,
    ${originLine}
  },
};

/** @type {import('vite').UserConfig} */
let baseConfig = {};
${importBlock}

export default mergeConfig(baseConfig, overlay);
`;
    await fs.writeFile(overlayPath, content, 'utf8');
    return overlayPath;
}
