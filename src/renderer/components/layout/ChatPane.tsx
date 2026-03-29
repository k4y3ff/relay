import { useEffect, useState, useCallback } from 'react';
import { useRepo } from '../../context/RepoContext';
import TerminalEmbed from '../chat/TerminalEmbed';
import DiffViewer from '../chat/DiffViewer';
import FileViewer from '../chat/FileViewer';

function basename(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

interface MountedTerminal {
  id: string;
  path: string;
}

export default function ChatPane() {
  const { activeWorktreePath, diffTabs, activePaneTab, dirtyTabs, closeDiffTab, selectPaneTab } = useRepo();

  // Map from worktreePath → ordered array of terminalIds
  const [chatTabsByPath, setChatTabsByPath] = useState<Map<string, string[]>>(new Map());
  // Map from worktreePath → currently active terminalId
  const [activeChatTabByPath, setActiveChatTabByPath] = useState<Map<string, string>>(new Map());
  // All ever-mounted terminals (never removed, keeps PTYs alive)
  const [mountedTerminals, setMountedTerminals] = useState<MountedTerminal[]>([]);

  // When the active worktree changes, ensure it has at least one chat tab
  useEffect(() => {
    if (!activeWorktreePath) return;
    setChatTabsByPath((prev) => {
      if (prev.has(activeWorktreePath)) return prev;
      const next = new Map(prev);
      const firstId = activeWorktreePath + ':0';
      next.set(activeWorktreePath, [firstId]);
      return next;
    });
    setActiveChatTabByPath((prev) => {
      if (prev.has(activeWorktreePath)) return prev;
      const next = new Map(prev);
      next.set(activeWorktreePath, activeWorktreePath + ':0');
      return next;
    });
    setMountedTerminals((prev) => {
      const firstId = activeWorktreePath + ':0';
      if (prev.some((t) => t.id === firstId)) return prev;
      return [...prev, { id: firstId, path: activeWorktreePath }];
    });
  }, [activeWorktreePath]);

  // When switching to the Chat tab, signal the active TerminalEmbed to re-fit.
  useEffect(() => {
    if (activePaneTab === 'chat') {
      window.dispatchEvent(new CustomEvent('terminal:refit'));
    }
  }, [activePaneTab]);

  const addChatTab = useCallback((worktreePath: string) => {
    const newId = worktreePath + ':' + Date.now();
    setChatTabsByPath((prev) => {
      const next = new Map(prev);
      next.set(worktreePath, [...(prev.get(worktreePath) ?? []), newId]);
      return next;
    });
    setActiveChatTabByPath((prev) => {
      const next = new Map(prev);
      next.set(worktreePath, newId);
      return next;
    });
    setMountedTerminals((prev) => [...prev, { id: newId, path: worktreePath }]);
    selectPaneTab('chat');
  }, [selectPaneTab]);

  const closeChatTab = useCallback((worktreePath: string, terminalId: string) => {
    setChatTabsByPath((prev) => {
      const tabs = prev.get(worktreePath) ?? [];
      const next = new Map(prev);
      next.set(worktreePath, tabs.filter((id) => id !== terminalId));
      return next;
    });
    setActiveChatTabByPath((prev) => {
      if (prev.get(worktreePath) !== terminalId) return prev;
      const tabs = chatTabsByPath.get(worktreePath) ?? [];
      const idx = tabs.indexOf(terminalId);
      const fallback = tabs[Math.max(0, idx - 1)] ?? tabs[0];
      const next = new Map(prev);
      next.set(worktreePath, fallback ?? '');
      return next;
    });
  }, [chatTabsByPath]);

  const activeDiffFile = diffTabs.find((t) => t.path === activePaneTab) ?? null;
  const activeChatTabs = activeWorktreePath ? (chatTabsByPath.get(activeWorktreePath) ?? []) : [];
  const activeChatTabId = activeWorktreePath ? (activeChatTabByPath.get(activeWorktreePath) ?? '') : '';

  return (
    <div className="chat-pane">
      {!activeWorktreePath && (
        <div className="pane-placeholder">Select a worktree to start chatting</div>
      )}
      {activeWorktreePath && (
        <div className="chat-tab-bar">
          {activeChatTabs.map((tabId, idx) => (
            <button
              key={tabId}
              className={`chat-tab${activePaneTab === 'chat' && activeChatTabId === tabId ? ' chat-tab-active' : ''}`}
              onClick={() => {
                setActiveChatTabByPath((prev) => {
                  const next = new Map(prev);
                  next.set(activeWorktreePath, tabId);
                  return next;
                });
                selectPaneTab('chat');
              }}
            >
              {idx === 0 ? 'Chat' : `Chat ${idx + 1}`}
              {idx > 0 && (
                <span
                  className="chat-tab-close"
                  onClick={(e) => { e.stopPropagation(); closeChatTab(activeWorktreePath, tabId); }}
                >
                  ×
                </span>
              )}
            </button>
          ))}
          <button
            className="chat-tab chat-tab-new"
            onClick={() => addChatTab(activeWorktreePath)}
            title="New chat"
          >
            +
          </button>
          {diffTabs.map((file) => (
            <button
              key={file.path}
              className={`chat-tab${activePaneTab === file.path ? ' chat-tab-active' : ''}`}
              onClick={() => selectPaneTab(file.path)}
              title={file.path}
            >
              {dirtyTabs.has(file.path) && <span className="chat-tab-dirty-dot" />}
              {basename(file.path)}
              <span
                className="chat-tab-close"
                onClick={(e) => { e.stopPropagation(); closeDiffTab(file.path); }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}
      {mountedTerminals.map(({ id, path }) => {
        const isActive = activePaneTab === 'chat' && path === activeWorktreePath && activeChatTabId === id;
        return (
          <div
            key={id}
            style={{ display: isActive ? 'flex' : 'none', flex: 1, minHeight: 0 }}
          >
            <TerminalEmbed terminalId={id} worktreePath={path} active={isActive} />
          </div>
        );
      })}
      {activeDiffFile && activeDiffFile.status === 'R' && activeWorktreePath && (
        <FileViewer worktreePath={activeWorktreePath} filePath={activeDiffFile.path} />
      )}
      {activeDiffFile && activeDiffFile.status !== 'R' && activeWorktreePath && (
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
