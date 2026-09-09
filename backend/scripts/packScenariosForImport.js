import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const BACKEND_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCENARIOS_ROOT = path.join(BACKEND_ROOT, 'scenarios');
const OUTPUT_PATH = path.join(BACKEND_ROOT, 'tmp', 'scenarios-import.zip');
const EXCLUDED_DIRECTORY_NAMES = new Set(['node_modules', '.git', 'dist', 'build']);

function isExcluded(archiveRelativePath) {
    return archiveRelativePath
        .split(/[\\/]/)
        .some((segment) => EXCLUDED_DIRECTORY_NAMES.has(segment));
}

if (!existsSync(SCENARIOS_ROOT)) {
    console.error(`No scenarios folder found at ${SCENARIOS_ROOT}`);
    process.exit(1);
}

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

const zip = new AdmZip();
zip.addLocalFolder(SCENARIOS_ROOT, 'scenarios', (entryPath) => !isExcluded(entryPath));
zip.writeZip(OUTPUT_PATH);

console.log(`Packed scenarios for import: ${OUTPUT_PATH}`);
console.log('Upload this zip from All Projects → Import on the deployed site.');
