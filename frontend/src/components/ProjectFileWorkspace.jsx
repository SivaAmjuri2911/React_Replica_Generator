import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client.js';
import { ScenarioFileExplorer } from './ScenarioFileExplorer.jsx';
import { collectPackageJsonPaths, directoryPathFromFile, fileLanguageFromPath, resolveRunTargetDir, } from '../utils/sessionSlug.js';

/** @param {import('./ScenarioFileExplorer.jsx').FileTreeNode[]} nodes */
function findFilePath(nodes, targetName) {
    for (const node of nodes) {
        if (node.type === 'file' && node.name === targetName) {
            return node.path;
        }
        if (node.type === 'directory' && node.children) {
            const nested = findFilePath(node.children, targetName);
            if (nested) {
                return nested;
            }
        }
    }
    return undefined;
}

/** @param {import('./ScenarioFileExplorer.jsx').FileTreeNode[]} nodes @param {string} targetName */
function findOutputFilePath(nodes, targetName) {
    for (const node of nodes) {
        if (node.type === 'file' && node.name === targetName && node.path.includes('/output/')) {
            return node.path;
        }
        if (node.type === 'directory' && node.children) {
            const nested = findOutputFilePath(node.children, targetName);
            if (nested) {
                return nested;
            }
        }
    }
    return undefined;
}

/**
 * @typedef {object} ProjectFileWorkspaceProps
 * @property {string} sessionSlug
 * @property {boolean} [preferOutput]
 * @property {boolean} [fullPage]
 */

/** @param {ProjectFileWorkspaceProps} props */
export function ProjectFileWorkspace({ sessionSlug, preferOutput = false, fullPage = false }) {
    const [selectedPath, setSelectedPath] = useState(undefined);
    const [savedContent, setSavedContent] = useState(undefined);
    const [editorContent, setEditorContent] = useState('');
    const [fileBinary, setFileBinary] = useState(false);
    const [fileSize, setFileSize] = useState(undefined);
    const [loadingFile, setLoadingFile] = useState(false);
    const [fileError, setFileError] = useState(undefined);
    const [saveError, setSaveError] = useState(undefined);
    const [saveMessage, setSaveMessage] = useState(undefined);
    const [saving, setSaving] = useState(false);
    const [runOutput, setRunOutput] = useState(undefined);
    const [runningScript, setRunningScript] = useState(undefined);
    const [autoSelected, setAutoSelected] = useState(false);
    const [packageJsonPaths, setPackageJsonPaths] = useState([]);
    const [runTargetDir, setRunTargetDir] = useState(undefined);
    const [treeRefreshKey, setTreeRefreshKey] = useState(0);

    const isDirty = selectedPath !== undefined && !fileBinary && savedContent !== undefined && editorContent !== savedContent;

    const handleTreeLoaded = useCallback((tree) => {
        const packages = collectPackageJsonPaths(tree);
        setPackageJsonPaths(packages);
        if (!autoSelected && !selectedPath) {
            const initialPath = preferOutput
                ? (findOutputFilePath(tree, 'App.jsx') ?? findOutputFilePath(tree, 'main.jsx'))
                : findFilePath(tree, 'spec.json');
            if (initialPath) {
                setSelectedPath(initialPath);
                setAutoSelected(true);
            }
        }
    }, [autoSelected, preferOutput, selectedPath]);

    const inferredRunTarget = useMemo(() => resolveRunTargetDir(selectedPath, packageJsonPaths), [selectedPath, packageJsonPaths]);
    const activeRunTarget = runTargetDir ?? inferredRunTarget;
    const canRun = Boolean(activeRunTarget);
    const canEdit = selectedPath !== undefined && !fileBinary && savedContent !== undefined;

    useEffect(() => {
        if (!runTargetDir && inferredRunTarget) {
            setRunTargetDir(inferredRunTarget);
        }
    }, [inferredRunTarget, runTargetDir]);

    const selectFile = useCallback((path) => {
        if (isDirty) {
            const confirmed = window.confirm('You have unsaved changes. Discard them and open another file?');
            if (!confirmed) {
                return;
            }
        }
        setSelectedPath(path);
        setSaveError(undefined);
        setSaveMessage(undefined);
    }, [isDirty]);

    useEffect(() => {
        if (!selectedPath) {
            setSavedContent(undefined);
            setEditorContent('');
            setFileBinary(false);
            setFileSize(undefined);
            setFileError(undefined);
            return;
        }
        let cancelled = false;
        setLoadingFile(true);
        setFileError(undefined);
        void apiClient.readSessionFile(sessionSlug, selectedPath)
            .then((file) => {
            if (cancelled) {
                return;
            }
            if (file.binary) {
                setFileBinary(true);
                setSavedContent(undefined);
                setEditorContent('');
                setFileSize(file.size);
                return;
            }
            setFileBinary(false);
            setSavedContent(file.content);
            setEditorContent(file.content);
            setFileSize(file.size);
        })
            .catch((error) => {
            if (!cancelled) {
                setFileError(error instanceof Error ? error.message : String(error));
            }
        })
            .finally(() => {
            if (!cancelled) {
                setLoadingFile(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [sessionSlug, selectedPath]);

    const handleSave = useCallback(async () => {
        if (!selectedPath || fileBinary || savedContent === undefined) {
            return;
        }
        setSaving(true);
        setSaveError(undefined);
        setSaveMessage(undefined);
        try {
            const result = await apiClient.writeSessionFile(sessionSlug, selectedPath, editorContent);
            setSavedContent(editorContent);
            setFileSize(result.size);
            setSaveMessage('Saved');
            setTreeRefreshKey((key) => key + 1);
        }
        catch (error) {
            setSaveError(error instanceof Error ? error.message : String(error));
        }
        finally {
            setSaving(false);
        }
    }, [sessionSlug, selectedPath, editorContent, fileBinary, savedContent]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                if (isDirty && !saving) {
                    void handleSave();
                }
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleSave, isDirty, saving]);

    const handleRevert = useCallback(() => {
        if (savedContent !== undefined) {
            setEditorContent(savedContent);
            setSaveError(undefined);
            setSaveMessage(undefined);
        }
    }, [savedContent]);

    const handleRun = useCallback(async (script) => {
        if (!activeRunTarget) {
            setRunOutput({
                script,
                relativeDir: '',
                exitCode: 1,
                stdout: '',
                stderr: 'Pick a runnable project folder (one that contains package.json), e.g. output/EquipmentRental_Solution.',
            });
            return;
        }
        setRunningScript(script);
        setRunOutput(undefined);
        try {
            const result = await apiClient.runSessionScript(sessionSlug, activeRunTarget, script);
            setRunOutput(result);
        }
        catch (error) {
            setRunOutput({
                script,
                relativeDir: activeRunTarget,
                exitCode: 1,
                stdout: '',
                stderr: error instanceof Error ? error.message : String(error),
            });
        }
        finally {
            setRunningScript(undefined);
        }
    }, [sessionSlug, activeRunTarget]);

    const packageDirOptions = useMemo(() => packageJsonPaths.map((packagePath) => directoryPathFromFile(packagePath)), [packageJsonPaths]);
    const selectedLanguage = selectedPath ? fileLanguageFromPath(selectedPath) : 'plaintext';

    return (<div className={`project-file-workspace ${fullPage ? 'project-file-workspace-page' : 'project-file-workspace-embedded'}`}>
      <aside className="project-file-sidebar">
        <ScenarioFileExplorer key={treeRefreshKey} sessionSlug={sessionSlug} selectedPath={selectedPath} onSelectFile={selectFile} onTreeLoaded={handleTreeLoaded}/>
      </aside>
      <div className="project-file-editor">
        <div className="project-file-tabbar">
          {selectedPath ? (<>
              <span className={`project-file-tab is-active ${isDirty ? 'project-file-tab-dirty' : ''}`}>
                {selectedPath.split('/').pop()}{isDirty ? ' •' : ''}
              </span>
              <span className="project-file-tab-path muted">{selectedPath}</span>
            </>) : (<span className="project-file-tab-path muted">Select a file to edit</span>)}

          <div className="project-file-run-actions">
            {canEdit && (<>
                <button type="button" className="project-action-btn project-action-btn-primary" disabled={!isDirty || saving} onClick={() => void handleSave()}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="project-action-btn" disabled={!isDirty || saving} onClick={handleRevert}>
                  Revert
                </button>
              </>)}
            {packageDirOptions.length > 0 && (<label className="project-file-run-target">
                <span className="muted">Run in</span>
                <select value={activeRunTarget ?? ''} onChange={(event) => setRunTargetDir(event.target.value || undefined)}>
                  {packageDirOptions.map((dir) => (<option key={dir} value={dir}>{dir}</option>))}
                </select>
              </label>)}
            <button type="button" className="project-action-btn" disabled={!canRun || runningScript !== undefined} onClick={() => void handleRun('dev')}>
              {runningScript === 'dev' ? 'Starting dev…' : 'Run dev'}
            </button>
            <button type="button" className="project-action-btn" disabled={!canRun || runningScript !== undefined} onClick={() => void handleRun('test')}>
              {runningScript === 'test' ? 'Running tests…' : 'Run tests'}
            </button>
          </div>
        </div>

        {!selectedPath && (<div className="project-file-empty">
            <h3>Edit & run project files</h3>
            <p className="muted">Pick a file from the explorer — edit it here, save, then run dev or tests.</p>
          </div>)}

        {selectedPath && (<div className="project-file-viewer">
            {loadingFile && <p className="muted project-file-status">Loading file…</p>}
            {fileError && <p className="error-text project-file-status">{fileError}</p>}
            {saveError && <p className="error-text project-file-status">{saveError}</p>}
            {saveMessage && <p className="project-file-save-ok project-file-status">{saveMessage}</p>}
            {!loadingFile && !fileError && fileBinary && (<p className="muted project-file-status">Binary file ({fileSize ?? 0} bytes) — not editable.</p>)}
            {!loadingFile && !fileError && canEdit && (<textarea className={`project-file-editor-input language-${selectedLanguage}`} value={editorContent} spellCheck={false} onChange={(event) => {
                setEditorContent(event.target.value);
                setSaveMessage(undefined);
            }}/>)}
          </div>)}

        {!canRun && packageDirOptions.length === 0 && (<p className="project-file-run-hint muted">No runnable npm project yet — build the replica to get an output folder.</p>)}

        {runOutput && (<div className="project-file-terminal">
            <div className="project-file-terminal-header">
              <strong>Terminal</strong>
              <span className={`status-badge ${runOutput.exitCode === 0 ? 'status-succeeded' : 'status-failed'}`}>
                {runOutput.exitCode === 0 ? 'Exit 0' : `Exit ${runOutput.exitCode}`}
              </span>
              <span className="muted">npm run {runOutput.script} — {runOutput.relativeDir || activeRunTarget}</span>
              {runOutput.url && (<a className="project-file-dev-link" href={runOutput.url} target="_blank" rel="noreferrer">
                  Open {runOutput.url}
                </a>)}
            </div>
            <pre className="project-file-terminal-output">{`${runOutput.stdout}${runOutput.stderr ? `\n${runOutput.stderr}` : ''}`.trim() || '(no output)'}</pre>
          </div>)}
      </div>
    </div>);
}
