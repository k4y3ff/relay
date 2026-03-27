import ChatPane from './ChatPane';
import RightColumn from './RightColumn';
import Sidebar from './Sidebar';

export default function AppShell() {
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
    </div>
  );
}
