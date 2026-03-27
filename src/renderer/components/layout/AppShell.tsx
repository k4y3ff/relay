import { useCallback, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import ChatPane from './ChatPane';
import RightColumn from './RightColumn';
import Sidebar from './Sidebar';
import { useChatSession } from '../../context/ChatContext';
import ClaudeNotInstalledModal from '../chat/ClaudeNotInstalledModal';

const MIN_SIDEBAR = 160;
const MIN_RIGHT = 220;

export default function AppShell() {
  const { claudeInstalled } = useChatSession();
  const [leftW, setLeftW] = useState(260);
  const [rightW, setRightW] = useState(320);

  const onLeftDividerMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = leftW;
      const onMove = (mv: MouseEvent) =>
        setLeftW(Math.max(MIN_SIDEBAR, startW + (mv.clientX - startX)));
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [leftW]
  );

  const onRightDividerMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = rightW;
      const onMove = (mv: MouseEvent) =>
        setRightW(Math.max(MIN_RIGHT, startW - (mv.clientX - startX)));
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [rightW]
  );

  return (
    <div className="app-shell">
      <div className="titlebar" />
      <div className="panel-row">
        <Sidebar style={{ width: leftW }} />
        <div className="divider-v resize-handle" onMouseDown={onLeftDividerMouseDown} />
        <ChatPane />
        <div className="divider-v resize-handle" onMouseDown={onRightDividerMouseDown} />
        <RightColumn style={{ width: rightW }} />
      </div>
      {!claudeInstalled && <ClaudeNotInstalledModal />}
    </div>
  );
}
