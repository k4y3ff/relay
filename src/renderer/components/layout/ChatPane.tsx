import { useEffect } from 'react';
import { useRepo } from '../../context/RepoContext';
import TerminalEmbed from '../chat/TerminalEmbed';
import DiffViewer from '../chat/DiffViewer';

export default function ChatPane() {
  const { activeWorktreePath, activeDiffFile } = useRepo();

  // When returning from diff mode, signal TerminalEmbed to re-fit its dimensions.
  useEffect(() => {
    if (!activeDiffFile) {
      window.dispatchEvent(new CustomEvent('terminal:refit'));
    }
  }, [activeDiffFile]);

  if (!activeWorktreePath) {
    return (
      <div className="chat-pane">
        <div className="pane-placeholder">Select a worktree to start chatting</div>
      </div>
    );
  }

  return (
    <div className="chat-pane">
      {/* Keep TerminalEmbed mounted at all times to preserve scrollback;
          hide it when a diff file is active */}
      <div style={{ display: activeDiffFile ? 'none' : 'flex', flex: 1, minHeight: 0 }}>
        <TerminalEmbed worktreePath={activeWorktreePath} />
      </div>
      {activeDiffFile && (
        <DiffViewer
          worktreePath={activeWorktreePath}
          filePath={activeDiffFile.path}
          added={activeDiffFile.added}
          deleted={activeDiffFile.deleted}
        />
      )}
    </div>
  );
}
