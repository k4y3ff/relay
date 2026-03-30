import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Search, X } from 'lucide-react';
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
  onFileClick,
  activeFilePath,
}: {
  node: TreeNode;
  depth: number;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
  onFileClick: (path: string) => void;
  activeFilePath: string;
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
              onFileClick={onFileClick}
              activeFilePath={activeFilePath}
            />
          ))}
      </>
    );
  }
  return (
    <button
      className={`all-files-row${activeFilePath === node.fullPath ? ' changed-files-row-active' : ''}`}
      style={{ paddingLeft: indent }}
      title={node.fullPath}
      onClick={() => onFileClick(node.fullPath)}
    >
      <span className="changed-files-path">{node.name}</span>
    </button>
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
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [changesNavActive, setChangesNavActive] = useState(false);
  const [changesSelectedIndex, setChangesSelectedIndex] = useState(-1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  // Cmd+Shift+F: switch to the All Files tab and open search/keyboard-nav mode
  useEffect(() => {
    return window.relay.on('focus:all-files', () => {
      setView('all');
      setIsSearching(true);
      setSelectedIndex(0);
    });
  }, []);

  // Cmd+Shift+C: switch to the Changes tab and activate keyboard navigation
  useEffect(() => {
    return window.relay.on('focus:changes-tab', () => {
      setView('changes');
      setChangesNavActive(true);
      setChangesSelectedIndex(0);
    });
  }, []);

  // Keyboard navigation for the Changes tab
  useEffect(() => {
    if (!changesNavActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setChangesSelectedIndex(i => Math.min(i + 1, files.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setChangesSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const file = files[changesSelectedIndex];
        if (file) { openDiffTab(file); setChangesNavActive(false); }
      } else if (e.key === 'Escape') {
        setChangesNavActive(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [changesNavActive, changesSelectedIndex, files, openDiffTab]);

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

  const closeSearch = useCallback(() => {
    setIsSearching(false);
    setSearchQuery('');
    setSelectedIndex(-1);
  }, []);

  // Reset selection to top when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll<HTMLElement>('[data-navigable]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Scroll selected Changes item into view
  useEffect(() => {
    if (changesSelectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll<HTMLElement>('[data-navigable]');
      items[changesSelectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [changesSelectedIndex]);

  const filteredFiles = searchQuery
    ? allFiles.filter(p => {
        const lower = searchQuery.toLowerCase();
        const filename = p.split('/').pop() ?? '';
        return filename.toLowerCase().includes(lower) || p.toLowerCase().includes(lower);
      })
    : allFiles;

  return (
    <div style={style} className="changed-files-pane">
      <div className="changed-files-header">
        {isSearching && view === 'all' ? (
          <input
            className="all-files-search-input"
            autoFocus
            placeholder="Search files..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { closeSearch(); return; }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, filteredFiles.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                const path = filteredFiles[selectedIndex];
                if (path) {
                  openDiffTab({ path, status: 'R', added: 0, deleted: 0 });
                  closeSearch();
                }
              }
            }}
          />
        ) : (
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
        )}
        {view === 'all' && (
          <button
            className="changed-files-refresh"
            onClick={() => {
              if (isSearching) closeSearch();
              else setIsSearching(true);
            }}
            disabled={!activeWorktreePath}
            title={isSearching ? 'Close search' : 'Search files'}
          >
            {isSearching ? <X size={12} /> : <Search size={12} />}
          </button>
        )}
        <button
          className="changed-files-refresh"
          onClick={handleRefresh}
          disabled={loading || !activeWorktreePath}
          title="Refresh"
        >
          ↺
        </button>
      </div>

      <div className="changed-files-list" ref={listRef}>
        {!activeWorktreePath ? (
          <div className="changed-files-empty">Select a worktree to see {view === 'all' ? 'files' : 'changes'}</div>
        ) : view === 'all' ? (
          allFiles.length === 0 && !loading ? (
            <div className="changed-files-empty">No files found</div>
          ) : isSearching ? (
            filteredFiles.length === 0 ? (
              <div className="changed-files-empty">No files match</div>
            ) : (
              filteredFiles.map((p, i) => (
                <button
                  key={p}
                  data-navigable="true"
                  className={`all-files-search-result${activePaneTab === p || i === selectedIndex ? ' changed-files-row-active' : ''}`}
                  title={p}
                  onClick={() => openDiffTab({ path: p, status: 'R', added: 0, deleted: 0 })}
                >
                  {p}
                </button>
              ))
            )
          ) : (
            buildTree(allFiles).map(node => (
              <FileTreeNode
                key={node.fullPath}
                node={node}
                depth={0}
                expandedDirs={expandedDirs}
                toggleDir={toggleDir}
                onFileClick={(p) => openDiffTab({ path: p, status: 'R', added: 0, deleted: 0 })}
                activeFilePath={activePaneTab}
              />
            ))
          )
        ) : files.length === 0 && !loading ? (
          <div className="changed-files-empty">No changes since last commit</div>
        ) : (
          files.map((file, i) => (
            <button
              key={file.path}
              data-navigable="true"
              className={`changed-files-row${activePaneTab === file.path || (changesNavActive && i === changesSelectedIndex) ? ' changed-files-row-active' : ''}`}
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
