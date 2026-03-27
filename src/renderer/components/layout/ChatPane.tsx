import { useRepo } from '../../context/RepoContext';
import { useChat } from '../../context/ChatContext';
import MessageList from '../chat/MessageList';
import ChatInput from '../chat/ChatInput';
import DiffViewer from '../chat/DiffViewer';

export default function ChatPane() {
  const { activeWorktreePath } = useRepo();
  const { diffView } = useChat();

  if (!activeWorktreePath) {
    return (
      <div className="chat-pane">
        <div className="pane-placeholder">Select a worktree to start chatting</div>
      </div>
    );
  }

  if (diffView) {
    return (
      <div className="chat-pane">
        <DiffViewer />
      </div>
    );
  }

  return (
    <div className="chat-pane">
      <MessageList worktreePath={activeWorktreePath} />
      <ChatInput worktreePath={activeWorktreePath} />
    </div>
  );
}
