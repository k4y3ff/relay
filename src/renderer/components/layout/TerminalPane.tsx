import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRepo } from '../../context/RepoContext';
import ShellEmbed, { ShellEmbedHandle } from '../terminal/ShellEmbed';
import ShellTabBar, { TabState } from '../terminal/ShellTabBar';

interface AllTab {
  tabId: string;
  label: string;
  worktreePath: string;
  cwd: string;
}

interface WtTabState {
  tabs: TabState[];
  activeTabId: string;
}

interface Props {
  style?: CSSProperties;
}

const MAX_TABS = 5;
const DEFAULT_LABEL = 'zsh';

export default function TerminalPane({ style }: Props) {
  const { activeWorktreePath, taskGroups } = useRepo();

  // Ref map: worktreePath -> tab state. Mutations don't trigger re-renders;
  // call syncState() after any mutation to flush to React state.
  const wtTabsRef = useRef(new Map<string, WtTabState>());

  // Flat render list — all tabs across all worktrees (keeps ShellEmbed mounted)
  const [renderList, setRenderList] = useState<AllTab[]>([]);
  // Current worktree's tab bar data
  const [currentTabs, setCurrentTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState('');

  // Imperative handles for each mounted ShellEmbed (keyed by tabId)
  const shellRefsMap = useRef(new Map<string, ShellEmbedHandle>());

  const syncState = useCallback((path: string | null) => {
    const all: AllTab[] = [];
    for (const [wtp, state] of wtTabsRef.current) {
      for (const tab of state.tabs) {
        all.push({ tabId: tab.id, label: tab.label, worktreePath: wtp, cwd: wtp });
      }
    }
    setRenderList(all);
    if (path) {
      const wt = wtTabsRef.current.get(path);
      setCurrentTabs(wt?.tabs ?? []);
      setActiveTabId(wt?.activeTabId ?? '');
    } else {
      setCurrentTabs([]);
      setActiveTabId('');
    }
  }, []);

  // Init tabs when active worktree changes
  useEffect(() => {
    if (!activeWorktreePath) {
      syncState(null);
      return;
    }
    if (!wtTabsRef.current.has(activeWorktreePath)) {
      const tabId = crypto.randomUUID();
      wtTabsRef.current.set(activeWorktreePath, {
        tabs: [{ id: tabId, label: DEFAULT_LABEL }],
        activeTabId: tabId,
      });
    }
    syncState(activeWorktreePath);
  }, [activeWorktreePath, syncState]);

  // Handle shell process exits — remove the tab, replace if it was the last one
  useEffect(() => {
    const onExit = (payload: unknown) => {
      const { tabId } = payload as { tabId: string };
      for (const [wtp, state] of wtTabsRef.current) {
        const idx = state.tabs.findIndex((t) => t.id === tabId);
        if (idx === -1) continue;

        shellRefsMap.current.delete(tabId);
        let newTabs = state.tabs.filter((t) => t.id !== tabId);
        let newActiveId = state.activeTabId;

        if (newTabs.length === 0) {
          const newId = crypto.randomUUID();
          newTabs = [{ id: newId, label: DEFAULT_LABEL }];
          newActiveId = newId;
        } else if (state.activeTabId === tabId) {
          newActiveId = newTabs[Math.max(0, idx - 1)]?.id ?? newTabs[0].id;
        }

        wtTabsRef.current.set(wtp, { tabs: newTabs, activeTabId: newActiveId });
        syncState(activeWorktreePath);
        break;
      }
    };
    return window.relay.on('shell:exit', onExit);
  }, [activeWorktreePath, syncState]);

  const handleSelectTab = useCallback((tabId: string) => {
    if (!activeWorktreePath) return;
    const state = wtTabsRef.current.get(activeWorktreePath);
    if (!state) return;
    wtTabsRef.current.set(activeWorktreePath, { ...state, activeTabId: tabId });
    syncState(activeWorktreePath);
  }, [activeWorktreePath, syncState]);

  const handleAddTab = useCallback(() => {
    if (!activeWorktreePath) return;
    const state = wtTabsRef.current.get(activeWorktreePath);
    if (!state || state.tabs.length >= MAX_TABS) return;
    const tabId = crypto.randomUUID();
    wtTabsRef.current.set(activeWorktreePath, {
      tabs: [...state.tabs, { id: tabId, label: DEFAULT_LABEL }],
      activeTabId: tabId,
    });
    syncState(activeWorktreePath);
  }, [activeWorktreePath, syncState]);

  const handleRenameTab = useCallback((tabId: string, label: string) => {
    if (!activeWorktreePath) return;
    const state = wtTabsRef.current.get(activeWorktreePath);
    if (!state) return;
    wtTabsRef.current.set(activeWorktreePath, {
      ...state,
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, label } : t)),
    });
    syncState(activeWorktreePath);
  }, [activeWorktreePath, syncState]);

  const handleCloseTab = useCallback((tabId: string) => {
    if (!activeWorktreePath) return;
    const state = wtTabsRef.current.get(activeWorktreePath);
    if (!state || state.tabs.length <= 1) return;
    window.relay.invoke('shell:close', { tabId });
    shellRefsMap.current.delete(tabId);
    const idx = state.tabs.findIndex((t) => t.id === tabId);
    const newTabs = state.tabs.filter((t) => t.id !== tabId);
    const newActiveId = state.activeTabId === tabId
      ? (newTabs[Math.max(0, idx - 1)]?.id ?? newTabs[0].id)
      : state.activeTabId;
    wtTabsRef.current.set(activeWorktreePath, { tabs: newTabs, activeTabId: newActiveId });
    syncState(activeWorktreePath);
  }, [activeWorktreePath, syncState]);

  // ⌘K — clear active terminal when focus is within the terminal body
  const shellBodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'k' && shellBodyRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        shellRefsMap.current.get(activeTabId)?.clear();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTabId]);

  // ⌘T — open a new terminal tab when focus is within the terminal pane
  useEffect(() => {
    return window.relay.on('tab:new-chat', () => {
      if (!shellBodyRef.current?.contains(document.activeElement)) return;
      handleAddTab();
      setTimeout(() => {
        const state = wtTabsRef.current.get(activeWorktreePath ?? '');
        if (state) shellRefsMap.current.get(state.activeTabId)?.focus();
      }, 0);
    });
  }, [activeWorktreePath, handleAddTab]);

  // ⌘⇧⎋ — close the active terminal tab when focus is within the terminal pane
  useEffect(() => {
    return window.relay.on('tab:close', () => {
      if (shellBodyRef.current?.contains(document.activeElement)) {
        handleCloseTab(activeTabId);
      }
    });
  }, [activeTabId, handleCloseTab]);

  // ⌘⇧T — focus the active terminal shell
  useEffect(() => {
    return window.relay.on('focus:terminal', () => {
      shellRefsMap.current.get(activeTabId)?.focus();
    });
  }, [activeTabId]);

  // Toolbar path: ~/path/to/worktree [branch]
  const displayPath = useMemo(() => {
    if (!activeWorktreePath) return '';
    let branch = '';
    outer: for (const group of taskGroups) {
      for (const t of group.tasks) {
        if (t.type === 'branch' && t.worktree.path === activeWorktreePath) { branch = t.worktree.branch; break outer; }
      }
    }
    const shortened = activeWorktreePath.replace(/^\/Users\/[^/]+/, '~');
    return branch ? `${shortened} [${branch}]` : shortened;
  }, [activeWorktreePath, taskGroups]);

  if (!activeWorktreePath) {
    return (
      <div style={style} className="overflow-hidden">
        <div className="pane-placeholder">Select a worktree to open a terminal</div>
      </div>
    );
  }

  return (
    <div style={style} className="shell-pane">
      <div className="shell-toolbar">
        <span className="shell-toolbar-path" title={activeWorktreePath}>{displayPath}</span>
        <button
          className="shell-clear-btn"
          onClick={() => shellRefsMap.current.get(activeTabId)?.clear()}
          title="Clear terminal (⌘K)"
        >
          ⌘K
        </button>
      </div>
      <ShellTabBar
        tabs={currentTabs}
        activeTabId={activeTabId}
        onSelect={handleSelectTab}
        onAdd={handleAddTab}
        onRename={handleRenameTab}
        onClose={handleCloseTab}
        maxTabs={MAX_TABS}
      />
      <div ref={shellBodyRef} className="shell-body">
        {renderList.map((tab) => (
          <ShellEmbed
            key={tab.tabId}
            ref={(handle) => {
              if (handle) shellRefsMap.current.set(tab.tabId, handle);
              else shellRefsMap.current.delete(tab.tabId);
            }}
            tabId={tab.tabId}
            cwd={tab.cwd}
            active={tab.tabId === activeTabId}
          />
        ))}
      </div>
    </div>
  );
}
