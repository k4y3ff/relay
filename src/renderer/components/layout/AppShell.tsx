import React, { useCallback, useEffect, useState } from 'react';
import ChatPane from './ChatPane';
import RightColumn from './RightColumn';
import Sidebar from './Sidebar';
import SettingsModal from '../SettingsModal';

const MIN_SIDEBAR = 160;
const MAX_SIDEBAR = 500;
const MIN_RIGHT = 200;
const MAX_RIGHT = 600;

export default function AppShell() {
  const [sidebarW, setSidebarW] = useState(260);
  const [rightW, setRightW] = useState(320);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    return window.relay.on('open:settings', () => setSettingsOpen(true));
  }, []);

  const onLeftDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = sidebarW;
      const onMove = (mv: MouseEvent) => {
        setSidebarW(Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, startW + (mv.clientX - startX))));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [sidebarW]
  );

  const onRightDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = rightW;
      const onMove = (mv: MouseEvent) => {
        setRightW(Math.max(MIN_RIGHT, Math.min(MAX_RIGHT, startW - (mv.clientX - startX))));
      };
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
        <Sidebar style={{ width: sidebarW }} />
        <div className="divider-v resize-handle" onMouseDown={onLeftDividerMouseDown} />
        <ChatPane />
        <div className="divider-v resize-handle" onMouseDown={onRightDividerMouseDown} />
        <RightColumn style={{ width: rightW }} />
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
