/**
 * @param {{ sessionSlug?: string, specPath?: string, detail?: string }} item
 * @returns {string|undefined}
 */
export function resolveSessionSlug(item) {
    if (item.sessionSlug) {
        return item.sessionSlug;
    }
    if (item.specPath) {
        const normalized = item.specPath.replace(/\\/g, '/');
        const match = normalized.match(/\/scenarios\/(analysis-[a-z0-9-]+)(?:\/|$)/i);
        if (match) {
            return match[1];
        }
    }
    if (item.detail?.startsWith('analysis-')) {
        return item.detail.split('/')[0];
    }
    return undefined;
}

/** @param {string} filePath */
export function fileLanguageFromPath(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const map = {
        js: 'javascript',
        jsx: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        json: 'json',
        css: 'css',
        html: 'html',
        md: 'markdown',
        yml: 'yaml',
        yaml: 'yaml',
    };
    return map[ext] ?? 'plaintext';
}

/** @param {string} filePath */
export function directoryPathFromFile(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    const index = normalized.lastIndexOf('/');
    return index >= 0 ? normalized.slice(0, index) : '';
}

/**
 * @param {Array<{ path: string, type: string }>} nodes
 * @returns {string[]}
 */
export function collectPackageJsonPaths(nodes) {
    /** @type {string[]} */
    const paths = [];
    for (const node of nodes) {
        if (node.type === 'file' && node.path.endsWith('package.json')) {
            paths.push(node.path);
        }
        if (node.type === 'directory' && 'children' in node && Array.isArray(node.children)) {
            paths.push(...collectPackageJsonPaths(node.children));
        }
    }
    return paths.sort((a, b) => a.localeCompare(b));
}

/**
 * @param {string|undefined} selectedPath
 * @param {string[]} packageJsonPaths
 */
export function resolveRunTargetDir(selectedPath, packageJsonPaths) {
    if (packageJsonPaths.length === 0) {
        return undefined;
    }
    if (!selectedPath) {
        return directoryPathFromFile(packageJsonPaths[0]);
    }
    const normalized = selectedPath.replace(/\\/g, '/');
    let best = '';
    for (const packagePath of packageJsonPaths) {
        const packageDir = directoryPathFromFile(packagePath);
        if (normalized === packageDir || normalized.startsWith(`${packageDir}/`)) {
            if (packageDir.length > best.length) {
                best = packageDir;
            }
        }
    }
    if (best) {
        return best;
    }
    const outputPackage = packageJsonPaths.find((packagePath) => packagePath.includes('/output/'));
    if (outputPackage) {
        return directoryPathFromFile(outputPackage);
    }
    return directoryPathFromFile(packageJsonPaths[0]);
}
