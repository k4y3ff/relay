import { useEffect, useState } from 'react';
import { useRepo } from '../../context/RepoContext';
import TerminalEmbed from '../chat/TerminalEmbed';
import DiffViewer from '../chat/DiffViewer';

export default function ChatPane() {
  const { activeWorktreePath, activeDiffFile } = useRepo();
  const [mountedPaths, setMountedPaths] = useState<string[]>([]);

  // Track all visited worktree paths so their terminals stay mounted
  useEffect(() => {
    if (activeWorktreePath) {
      setMountedPaths((prev) =>
        prev.includes(activeWorktreePath) ? prev : [...prev, activeWorktreePath]
      );
    }
  }, [activeWorktreePath]);

  // When returning from diff mode, signal the active TerminalEmbed to re-fit.
  useEffect(() => {
    if (!activeDiffFile) {
      window.dispatchEvent(new CustomEvent('terminal:refit'));
    }
  }, [activeDiffFile]);

  return (
    <div className="chat-pane">
      {!activeWorktreePath && (
        <div className="pane-placeholder">Select a worktree to start chatting</div>
      )}
      {mountedPaths.map((path) => {
        const isActive = !activeDiffFile && path === activeWorktreePath;
        return (
          <div
            key={path}
            style={{ display: isActive ? 'flex' : 'none', flex: 1, minHeight: 0 }}
          >
            <TerminalEmbed worktreePath={path} active={isActive} />
          </div>
        );
      })}
      {activeDiffFile && activeWorktreePath && (
        <DiffViewer
          worktreePath={activeWorktreePath}
          filePath={activeDiffFile.path}
          status={activeDiffFile.status}
          added={activeDiffFile.added}
          deleted={activeDiffFile.deleted}
        />
      )}
    </div>
  );
}
