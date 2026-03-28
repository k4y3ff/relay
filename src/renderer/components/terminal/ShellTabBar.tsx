import { useEffect, useRef } from 'react';

export interface TabState {
  id: string;
  label: string;
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

const MENU_ID = 'shell-tab-context-menu';

export default function ShellTabBar({ tabs, activeTabId, onSelect, onAdd, onRename, onClose, maxTabs }: Props) {
  const contextTabRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = window.relay.on('menu:item-clicked', (data: unknown) => {
      const { menuId, itemIndex } = data as { menuId: string; itemIndex: number };
      if (menuId !== MENU_ID) return;
      const tabId = contextTabRef.current;
      if (!tabId) return;
      if (itemIndex === 0) {
        // Rename: prompt inline (fall back to browser prompt since native rename input isn't trivial)
        const tab = tabs.find(t => t.id === tabId);
        const newLabel = window.prompt('Rename tab', tab?.label ?? '');
        if (newLabel?.trim()) onRename(tabId, newLabel.trim());
      } else if (itemIndex === 1) {
        onClose(tabId);
      }
      contextTabRef.current = null;
    });
    return unsubscribe;
  }, [tabs, onRename, onClose]);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    contextTabRef.current = tabId;
    const canClose = tabs.length > 1;
    void window.relay.invoke('menu:show-context-menu', {
      menuId: MENU_ID,
      items: [
        { label: 'Rename' },
        { label: 'Close', enabled: canClose },
      ],
    });
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
          <span className="shell-tab-label">{tab.label}</span>
          <button
            className="shell-tab-close"
            onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
            disabled={tabs.length <= 1}
            title="Close tab"
          >
            ×
          </button>
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
    </div>
  );
}
