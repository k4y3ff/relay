import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { useRepo } from '../../context/RepoContext';
import type { ChangedFile } from '../../types/repo';

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const filePath of paths) {
    const parts = filePath.split('/');
    let nodes = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const fullPath = parts.slice(0, i + 1).join('/');
      const isDir = i < parts.length - 1;
      let node = nodes.find(n => n.name === name);
      if (!node) {
        node = { name, fullPath, isDir, children: [] };
        nodes.push(node);
      }
      nodes = node.children;
    }
  }
  return root;
}

function FileTreeNode({
  node,
  depth,
  expandedDirs,
  toggleDir,
}: {
  node: TreeNode;
  depth: number;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
}) {
  const indent = depth * 14 + 10;
  if (node.isDir) {
    const expanded = expandedDirs.has(node.fullPath);
    return (
      <>
        <button
          className="all-files-dir-row"
          style={{ paddingLeft: indent }}
          onClick={() => toggleDir(node.fullPath)}
          title={node.fullPath}
        >
          <span className="all-files-chevron">{expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}</span>
          <span className="all-files-folder-icon">{expanded ? <FolderOpen size={12} /> : <Folder size={12} />}</span>
          <span className="changed-files-path">{node.name}</span>
        </button>
        {expanded &&
          node.children.map(child => (
            <FileTreeNode
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
            />
          ))}
      </>
    );
  }
  return (
    <div
      className="all-files-row"
      style={{ paddingLeft: indent }}
      title={node.fullPath}
    >
      <span className="changed-files-path">{node.name}</span>
    </div>
  );
}

interface Props {
  style?: CSSProperties;
}

const STATUS_COLORS: Record<string, string> = {
  M: '#f59e0b',
  A: '#34d399',
  D: '#f87171',
  '?': '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  M: 'M',
  A: 'A',
  D: 'D',
  '?': '?',
};

type View = 'changes' | 'all';

export default function ChangedFilesPane({ style }: Props) {
  const { activeWorktreePath, activePaneTab, openDiffTab } = useRepo();
  const [view, setView] = useState<View>('changes');
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!activeWorktreePath) {
      setFiles([]);
      return;
    }
    setLoading(true);
    try {
      const result = (await window.relay.invoke('git:changed-files', {
        worktreePath: activeWorktreePath,
      })) as ChangedFile[];
      setFiles(result);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [activeWorktreePath]);

  const fetchAllFiles = useCallback(async () => {
    if (!activeWorktreePath) {
      setAllFiles([]);
      return;
    }
    setLoading(true);
    try {
      const result = (await window.relay.invoke('git:all-files', {
        worktreePath: activeWorktreePath,
      })) as string[];
      setAllFiles(result);
    } catch {
      setAllFiles([]);
    } finally {
      setLoading(false);
    }
  }, [activeWorktreePath]);

  // Fetch on mount and when active worktree changes
  useEffect(() => {
    fetchFiles();
    fetchAllFiles();
  }, [fetchFiles, fetchAllFiles]);

  // Auto-refresh every 3 seconds when window is focused
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (document.hasFocus()) {
        fetchFiles();
      }
    }, 3000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [fetchFiles]);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleRefresh = view === 'changes' ? fetchFiles : fetchAllFiles;

  return (
    <div style={style} className="changed-files-pane">
      <div className="changed-files-header">
        <div className="files-tabs">
          <button
            className={`files-tab${view === 'all' ? ' files-tab-active' : ''}`}
            onClick={() => setView('all')}
          >
            All Files
          </button>
          <button
            className={`files-tab${view === 'changes' ? ' files-tab-active' : ''}`}
            onClick={() => setView('changes')}
          >
            Changes{files.length > 0 ? ` ${files.length}` : ''}
          </button>
        </div>
        <button
          className="changed-files-refresh"
          onClick={handleRefresh}
          disabled={loading || !activeWorktreePath}
          title="Refresh"
        >
          ↺
        </button>
      </div>

      <div className="changed-files-list">
        {!activeWorktreePath ? (
          <div className="changed-files-empty">Select a worktree to see {view === 'all' ? 'files' : 'changes'}</div>
        ) : view === 'all' ? (
          allFiles.length === 0 && !loading ? (
            <div className="changed-files-empty">No files found</div>
          ) : (
            buildTree(allFiles).map(node => (
              <FileTreeNode
                key={node.fullPath}
                node={node}
                depth={0}
                expandedDirs={expandedDirs}
                toggleDir={toggleDir}
              />
            ))
          )
        ) : files.length === 0 && !loading ? (
          <div className="changed-files-empty">No changes since last commit</div>
        ) : (
          files.map((file) => (
            <button
              key={file.path}
              className={`changed-files-row${activePaneTab === file.path ? ' changed-files-row-active' : ''}`}
              onClick={() => openDiffTab(file)}
              title={file.path}
            >
              <span
                className="changed-files-status"
                style={{
                  background: STATUS_COLORS[file.status],
                  color: '#000',
                  borderRadius: 3,
                  padding: '0 4px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  lineHeight: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {STATUS_LABELS[file.status]}
              </span>
              <span className="changed-files-path">{file.path}</span>
              <span className="changed-files-stats">
                {file.added > 0 && (
                  <span className="changed-files-added">+{file.added}</span>
                )}
                {file.deleted > 0 && (
                  <span className="changed-files-deleted">-{file.deleted}</span>
                )}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
