import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { migrateLegacyIdeBasedCodingLayout } from '../src/config/migrateLegacyIdeBasedCodingLayout.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultScenariosRoot = path.resolve(scriptDir, '../scenarios');

async function main() {
    const scenariosRoot = process.argv[2]
        ? path.resolve(process.argv[2])
        : defaultScenariosRoot;

    const entries = await fs.readdir(scenariosRoot, { withFileTypes: true }).catch(() => []);
    let migratedCount = 0;

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const sessionDir = path.join(scenariosRoot, entry.name);
        const result = await migrateLegacyIdeBasedCodingLayout(sessionDir);
        if (result.migrated) {
            migratedCount += 1;
            console.log(`Migrated ${entry.name} -> output/IDE_BASED_CODING/{uuid}.json`);
        }
    }

    console.log(`Done. Migrated ${migratedCount} project(s) under ${scenariosRoot}.`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
