import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client.js';

/**
 * @typedef {object} FileTreeNode
 * @property {string} name
 * @property {string} path
 * @property {'file'|'directory'} type
 * @property {FileTreeNode[]|undefined} [children]
 */

/**
 * @typedef {object} ScenarioFileExplorerProps
 * @property {string} sessionSlug
 * @property {string|undefined} selectedPath
 * @property {(path: string) => void} onSelectFile
 * @property {(tree: FileTreeNode[]) => void} [onTreeLoaded]
 * @property {number} [refreshToken]
 */

/** @param {string} name */
function fileIcon(name) {
    if (name.endsWith('.jsx') || name.endsWith('.tsx')) {
        return '◆';
    }
    if (name.endsWith('.js') || name.endsWith('.ts')) {
        return '◇';
    }
    if (name.endsWith('.json')) {
        return '{ }';
    }
    if (name.endsWith('.css')) {
        return '#';
    }
    if (name.endsWith('.md')) {
        return 'M↓';
    }
    return '·';
}

/**
 * @param {{
 *   node: FileTreeNode,
 *   depth: number,
 *   selectedPath: string|undefined,
 *   expandedPaths: ReadonlySet<string>,
 *   onToggle: (path: string) => void,
 *   onSelectFile: (path: string) => void,
 * }} props
 */
function TreeNode({ node, depth, selectedPath, expandedPaths, onToggle, onSelectFile }) {
    const isDirectory = node.type === 'directory';
    const isExpanded = isDirectory && expandedPaths.has(node.path);
    const isSelected = !isDirectory && selectedPath === node.path;

    return (<li className="file-tree-node">
      {isDirectory ? (<button type="button" className={`file-tree-row file-tree-folder ${isExpanded ? 'is-expanded' : ''}`} style={{ paddingLeft: `${8 + depth * 14}px` }} onClick={() => onToggle(node.path)}>
          <span className="file-tree-chevron" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
          <span className="file-tree-icon folder" aria-hidden="true">{isExpanded ? '📂' : '📁'}</span>
          <span className="file-tree-label">{node.name}</span>
        </button>) : (<button type="button" className={`file-tree-row file-tree-file ${isSelected ? 'is-selected' : ''}`} style={{ paddingLeft: `${22 + depth * 14}px` }} onClick={() => onSelectFile(node.path)}>
          <span className="file-tree-icon file" aria-hidden="true">{fileIcon(node.name)}</span>
          <span className="file-tree-label">{node.name}</span>
        </button>)}
      {isDirectory && isExpanded && node.children && node.children.length > 0 && (<ul className="file-tree-children">
          {node.children.map((child) => (<TreeNode key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} expandedPaths={expandedPaths} onToggle={onToggle} onSelectFile={onSelectFile}/>))}
        </ul>)}
    </li>);
}

/** @param {import('./ScenarioFileExplorer.jsx').FileTreeNode[]} nodes */
function collectDefaultExpandedPaths(nodes) {
    /** @type {string[]} */
    const paths = ['uploaded', 'output', 'spec.json'];
    for (const node of nodes) {
        if (node.type !== 'directory') {
            continue;
        }
        paths.push(node.path);
        if (node.path === 'output' && node.children) {
            for (const child of node.children) {
                if (child.type === 'directory') {
                    paths.push(child.path);
                }
            }
        }
        if (node.name === 'IDE_BASED_CODING' || node.name.endsWith('_tests')) {
            paths.push(node.path);
        }
    }
    return paths;
}

/** @param {ScenarioFileExplorerProps} props */
export function ScenarioFileExplorer({ sessionSlug, selectedPath, onSelectFile, onTreeLoaded, refreshToken = 0 }) {
    const [tree, setTree] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(undefined);
    const [expandedPaths, setExpandedPaths] = useState(() => new Set(['uploaded', 'output', 'spec.json']));

    const loadTree = useCallback(async () => {
        setLoading(true);
        setError(undefined);
        try {
            const result = await apiClient.listSessionFileTree(sessionSlug);
            setTree(result);
            onTreeLoaded?.(result);
            setExpandedPaths((current) => {
                const next = new Set(current);
                for (const path of collectDefaultExpandedPaths(result)) {
                    next.add(path);
                }
                return next;
            });
        }
        catch (loadError) {
            setTree([]);
            setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
        finally {
            setLoading(false);
        }
    }, [sessionSlug, onTreeLoaded]);

    useEffect(() => {
        void loadTree();
    }, [loadTree, refreshToken]);

    const handleToggle = useCallback((path) => {
        setExpandedPaths((current) => {
            const next = new Set(current);
            if (next.has(path)) {
                next.delete(path);
            }
            else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const rootLabel = useMemo(() => sessionSlug, [sessionSlug]);

    return (<div className="file-explorer">
      <div className="file-explorer-toolbar">
        <span className="file-explorer-title">Explorer</span>
        <button type="button" className="file-explorer-refresh" onClick={() => void loadTree()} aria-label="Refresh files">
          ↻
        </button>
      </div>
      <div className="file-explorer-root-label">{rootLabel}</div>
      {loading && <p className="file-explorer-status muted">Loading files…</p>}
      {error && <p className="file-explorer-status error-text">{error}</p>}
      {!loading && !error && tree.length === 0 && <p className="file-explorer-status muted">No files yet.</p>}
      {!loading && !error && tree.length > 0 && (<ul className="file-tree">
          {tree.map((node) => (<TreeNode key={node.path} node={node} depth={0} selectedPath={selectedPath} expandedPaths={expandedPaths} onToggle={handleToggle} onSelectFile={onSelectFile}/>))}
        </ul>)}
    </div>);
}
