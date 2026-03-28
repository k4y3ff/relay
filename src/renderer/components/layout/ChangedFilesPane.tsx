import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { useRepo } from '../../context/RepoContext';
import type { ChangedFile } from '../../types/repo';

interface Props {
  style?: CSSProperties;
}

const STATUS_COLORS: Record<string, string> = {
  M: 'var(--color-status-modified, #d97706)',
  A: 'var(--color-status-added, #16a34a)',
  D: 'var(--color-status-deleted, #dc2626)',
  '?': 'var(--color-status-untracked, #6b7280)',
};

const STATUS_LABELS: Record<string, string> = {
  M: 'M',
  A: 'A',
  D: 'D',
  '?': '?',
};

type View = 'changes' | 'all';

export default function ChangedFilesPane({ style }: Props) {
  const { activeWorktreePath, activeDiffFile, setActiveDiffFile } = useRepo();
  const [view, setView] = useState<View>('changes');
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [allFiles, setAllFiles] = useState<string[]>([]);
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
            allFiles.map((filePath) => (
              <div key={filePath} className="all-files-row" title={filePath}>
                <span className="changed-files-path">{filePath}</span>
              </div>
            ))
          )
        ) : files.length === 0 && !loading ? (
          <div className="changed-files-empty">No changes since last commit</div>
        ) : (
          files.map((file) => (
            <button
              key={file.path}
              className={`changed-files-row${activeDiffFile?.path === file.path ? ' changed-files-row-active' : ''}`}
              onClick={() => setActiveDiffFile(file)}
              title={file.path}
            >
              <span
                className="changed-files-status"
                style={{ color: STATUS_COLORS[file.status] }}
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
