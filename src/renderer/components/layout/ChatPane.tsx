import { useRepo } from '../../context/RepoContext';
import TerminalEmbed from '../chat/TerminalEmbed';

export default function ChatPane() {
  const { activeWorktreePath } = useRepo();

  if (!activeWorktreePath) {
    return (
      <div className="chat-pane">
        <div className="pane-placeholder">Select a worktree to start chatting</div>
      </div>
    );
  }

  return (
    <div className="chat-pane">
      <TerminalEmbed worktreePath={activeWorktreePath} />
    </div>
  );
}
