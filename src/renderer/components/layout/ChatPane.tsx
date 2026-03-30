import { useEffect, useRef, useState, useCallback } from 'react';
import { useRepo } from '../../context/RepoContext';
import TerminalEmbed from '../chat/TerminalEmbed';
import DiffViewer from '../chat/DiffViewer';
import FileViewer from '../chat/FileViewer';
import ManualTaskNotesPane from './ManualTaskNotesPane';
import type { ManualTask } from '../../types/repo';

function basename(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

const CHAT_TAB_MENU_ID = 'chat-tab-context-menu';

interface MountedTerminal {
  id: string;
  path: string;
}

export default function ChatPane() {
  const { activeWorktreePath, activeManualTaskId, taskGroups, diffTabs, activePaneTab, dirtyTabs, closeDiffTab, selectPaneTab } = useRepo();

  // Find the active manual task and its group
  let activeManualTask: ManualTask | null = null;
  let activeManualTaskGroupId: string | null = null;
  if (activeManualTaskId) {
    for (const g of taskGroups) {
      const t = g.tasks.find((t) => t.id === activeManualTaskId);
      if (t && t.type === 'manual') {
        activeManualTask = t;
        activeManualTaskGroupId = g.id;
        break;
      }
    }
  }

  // Map from worktreePath → ordered array of terminalIds
  const [chatTabsByPath, setChatTabsByPath] = useState<Map<string, string[]>>(new Map());
  // Map from worktreePath → currently active terminalId
  const [activeChatTabByPath, setActiveChatTabByPath] = useState<Map<string, string>>(new Map());
  // All ever-mounted terminals (never removed, keeps PTYs alive)
  const [mountedTerminals, setMountedTerminals] = useState<MountedTerminal[]>([]);
  // Custom labels for chat tabs (terminalId → label)
  const [chatTabLabels, setChatTabLabels] = useState<Map<string, string>>(new Map());
  // Tracks which tab is currently being renamed inline
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  // Tracks which tab was right-clicked, for the context menu handler
  const contextTabRef = useRef<string | null>(null);

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

  // Handle context menu actions for chat tabs
  useEffect(() => {
    return window.relay.on('menu:item-clicked', (data: unknown) => {
      const { menuId, itemIndex } = data as { menuId: string; itemIndex: number };
      if (menuId !== CHAT_TAB_MENU_ID) return;
      const tabId = contextTabRef.current;
      if (!tabId) return;
      if (itemIndex === 0) {
        const current = chatTabLabels.get(tabId) ?? '';
        setRenameValue(current);
        setRenamingTabId(tabId);
      }
      contextTabRef.current = null;
    });
  }, [chatTabLabels]);

  // Focus the rename input once it mounts
  useEffect(() => {
    if (renamingTabId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingTabId]);

  const commitRename = useCallback(() => {
    if (renamingTabId) {
      if (renameValue.trim()) {
        setChatTabLabels((prev) => new Map(prev).set(renamingTabId, renameValue.trim()));
      }
      setRenamingTabId(null);
    }
  }, [renamingTabId, renameValue]);

  const handleChatTabContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    contextTabRef.current = tabId;
    void window.relay.invoke('menu:show-context-menu', {
      menuId: CHAT_TAB_MENU_ID,
      items: [{ label: 'Rename' }],
    });
  }, []);

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

  // Cmd+Shift+C (IPC) or chat:focus (DOM event): focus the active chat terminal
  useEffect(() => {
    const focus = () => {
      selectPaneTab('chat');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('terminal:focus', { detail: { terminalId: activeChatTabId } }));
      }, 0);
    };
    const offIpc = window.relay.on('focus:chat-terminal', focus);
    window.addEventListener('chat:focus', focus);
    return () => { offIpc(); window.removeEventListener('chat:focus', focus); };
  }, [activeChatTabId, selectPaneTab]);

  // Cmd+Shift+[ / Cmd+Shift+]: navigate left/right through the tab bar
  useEffect(() => {
    const navigate = (dir: -1 | 1) => {
      if (!activeWorktreePath) return;
      const allTabs = [...activeChatTabs, ...diffTabs.map((t) => t.path)];
      const currentIdx = activePaneTab === 'chat'
        ? activeChatTabs.indexOf(activeChatTabId)
        : activeChatTabs.length + diffTabs.findIndex((t) => t.path === activePaneTab);
      const nextIdx = currentIdx + dir;
      if (nextIdx < 0 || nextIdx >= allTabs.length) return;
      if (nextIdx < activeChatTabs.length) {
        setActiveChatTabByPath((prev) => new Map(prev).set(activeWorktreePath, allTabs[nextIdx]));
        selectPaneTab('chat');
      } else {
        selectPaneTab(allTabs[nextIdx]);
      }
    };
    const offPrev = window.relay.on('tab:prev', () => navigate(-1));
    const offNext = window.relay.on('tab:next', () => navigate(1));
    return () => { offPrev(); offNext(); };
  }, [activeChatTabs, activeChatTabId, diffTabs, activePaneTab, activeWorktreePath, setActiveChatTabByPath, selectPaneTab]);

  return (
    <div className="chat-pane">
      {activeManualTask && activeManualTaskGroupId && (
        <ManualTaskNotesPane groupId={activeManualTaskGroupId} task={activeManualTask} />
      )}
      {!activeWorktreePath && !activeManualTask && (
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
              onContextMenu={(e) => handleChatTabContextMenu(e, tabId)}
            >
              {renamingTabId === tabId ? (
                <input
                  ref={renameInputRef}
                  className="chat-tab-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingTabId(null);
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                chatTabLabels.get(tabId) ?? (idx === 0 ? 'Chat' : `Chat ${idx + 1}`)
              )}
              {activeChatTabs.length > 1 && (
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
          chatTabs={activeChatTabs}
          activeChatTabId={activeChatTabId}
          chatTabLabels={chatTabLabels}
          onOpenChat={(tabId) => {
            setActiveChatTabByPath((prev) => {
              const next = new Map(prev);
              next.set(activeWorktreePath, tabId);
              return next;
            });
            selectPaneTab('chat');
          }}
        />
      )}
    </div>
  );
}
