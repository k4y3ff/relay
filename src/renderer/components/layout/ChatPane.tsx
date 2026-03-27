import { useRepo } from '../../context/RepoContext';
import ChatView from '../chat/ChatView';
import DiffViewer from '../chat/DiffViewer';

export default function ChatPane() {
  const { activeWorktreePath, activeDiffFile } = useRepo();

  if (!activeWorktreePath) {
    return (
      <div className="chat-pane">
        <div className="pane-placeholder">Select a worktree to start chatting</div>
      </div>
    );
  }

  return (
    <div className="chat-pane">
      {/* Keep ChatView mounted to preserve message history; hide when diff is active */}
      <div style={{ display: activeDiffFile ? 'none' : 'flex', flex: 1, minHeight: 0 }}>
        <ChatView worktreePath={activeWorktreePath} />
      </div>
      {activeDiffFile && (
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
