import ChatPane from './ChatPane';
import RightColumn from './RightColumn';
import Sidebar from './Sidebar';
import { useChatSession } from '../../context/ChatContext';
import ClaudeNotInstalledModal from '../chat/ClaudeNotInstalledModal';

export default function AppShell() {
  const { claudeInstalled } = useChatSession();

  return (
    <div className="app-shell">
      <div className="titlebar" />
      <div className="panel-row">
        <Sidebar />
        <div className="divider-v" />
        <ChatPane />
        <div className="divider-v" />
        <RightColumn />
      </div>
      {!claudeInstalled && <ClaudeNotInstalledModal />}
    </div>
  );
}
