import { useEffect, useRef, useState } from 'react';

export interface TabState {
  id: string;
  label: string;
}

interface ContextMenu {
  tabId: string;
  x: number;
  y: number;
}

interface Props {
  tabs: TabState[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, label: string) => void;
  onClose: (id: string) => void;
  maxTabs: number;
}

export default function ShellTabBar({ tabs, activeTabId, onSelect, onAdd, onRename, onClose, maxTabs }: Props) {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  };

  const startRename = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    setRenamingId(tabId);
    setRenameValue(tab?.label ?? '');
    setContextMenu(null);
  };

  const commitRename = (tabId: string) => {
    if (renameValue.trim()) onRename(tabId, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <div className="shell-tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`shell-tab${tab.id === activeTabId ? ' shell-tab-active' : ''}`}
          onClick={() => onSelect(tab.id)}
          onContextMenu={(e) => handleContextMenu(e, tab.id)}
          title={tab.label}
        >
          {renamingId === tab.id ? (
            <input
              className="shell-tab-rename"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => commitRename(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(tab.id);
                if (e.key === 'Escape') setRenamingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span className="shell-tab-label">{tab.label}</span>
          )}
        </button>
      ))}
      <button
        className="shell-tab-add"
        onClick={onAdd}
        disabled={tabs.length >= maxTabs}
        title="New tab"
      >
        +
      </button>
      {contextMenu && (
        <div
          ref={menuRef}
          className="shell-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button onClick={() => startRename(contextMenu.tabId)}>Rename</button>
          <button
            onClick={() => {
              onClose(contextMenu.tabId);
              setContextMenu(null);
            }}
            disabled={tabs.length <= 1}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
