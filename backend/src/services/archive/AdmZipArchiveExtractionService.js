import { promises as fs } from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { err, ok } from '../../shared/Result.js';
import { FileSystemError } from '../../domain/errors/GenerationError.js';
/**
 * @implements {ArchiveExtractionService}
 */
export class AdmZipArchiveExtractionService {
    async extractZip(zipFilePath, destinationDir) {
        try {
            const zip = new AdmZip(zipFilePath);
            zip.extractAllTo(destinationDir, true);
            await this.flattenSingleWrapperFolder(destinationDir);
            return ok(undefined);
        }
        catch (cause) {
            return err(new FileSystemError(`Failed to extract zip "${zipFilePath}" to "${destinationDir}"`, {
                zipFilePath,
                destinationDir,
                cause,
            }));
        }
    }
    /**
     * Zipping a folder from a file explorer usually produces one wrapper
     * directory inside the archive (e.g. "Bid_Solution/src/..." instead of
     * "src/..."). If extraction produced exactly one top-level directory and
     * nothing else, promote its contents up one level so callers always get a
     * project root directly, regardless of how the operator zipped it.
     */
    async flattenSingleWrapperFolder(destinationDir) {
        const entries = await fs.readdir(destinationDir, { withFileTypes: true });
        if (entries.length !== 1 || !entries[0]?.isDirectory()) {
            return;
        }
        const wrapperDir = path.join(destinationDir, entries[0].name);
        const innerEntries = await fs.readdir(wrapperDir);
        for (const innerEntry of innerEntries) {
            await fs.rename(path.join(wrapperDir, innerEntry), path.join(destinationDir, innerEntry));
        }
        await fs.rmdir(wrapperDir);
    }
}
