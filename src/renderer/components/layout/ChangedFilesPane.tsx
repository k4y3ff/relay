import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { useRepo } from '../../context/RepoContext';
import { useChatSession } from '../../context/ChatContext';
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

export default function ChangedFilesPane({ style }: Props) {
  const { activeWorktreePath, activeDiffFile, setActiveDiffFile } = useRepo();
  const { appendFileEditBanner } = useChatSession();
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevFilesRef = useRef<ChangedFile[]>([]);

  const fetchFiles = useCallback(async () => {
    if (!activeWorktreePath) {
      setFiles([]);
      prevFilesRef.current = [];
      return;
    }
    setLoading(true);
    try {
      const result = (await window.relay.invoke('git:changed-files', {
        worktreePath: activeWorktreePath,
      })) as ChangedFile[];

      // Emit a file-edit banner if the set of changed files has grown
      const prev = prevFilesRef.current;
      if (prev.length > 0 && result.length > prev.length) {
        const prevPaths = new Set(prev.map((f) => f.path));
        const newPaths = result.map((f) => f.path).filter((p) => !prevPaths.has(p));
        if (newPaths.length > 0) {
          appendFileEditBanner(activeWorktreePath, newPaths);
        }
      }
      prevFilesRef.current = result;

      setFiles(result);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [activeWorktreePath, appendFileEditBanner]);

  // Fetch on mount and when active worktree changes
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

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

  return (
    <div style={style} className="changed-files-pane">
      <div className="changed-files-header">
        <span className="changed-files-title">
          Changes{files.length > 0 ? ` ${files.length}` : ''}
        </span>
        <button
          className="changed-files-refresh"
          onClick={fetchFiles}
          disabled={loading || !activeWorktreePath}
          title="Refresh"
        >
          ↺
        </button>
      </div>

      <div className="changed-files-list">
        {!activeWorktreePath ? (
          <div className="changed-files-empty">Select a worktree to see changes</div>
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
