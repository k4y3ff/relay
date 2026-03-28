import { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  danger?: boolean;
  action: () => void;
}

interface OverflowMenuProps {
  items: MenuItem[];
}

let menuCounter = 0;

export default function OverflowMenu({ items }: OverflowMenuProps) {
  const menuIdRef = useRef(`overflow-menu-${++menuCounter}`);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const menuId = menuIdRef.current;
    const unsubscribe = window.relay.on('menu:item-clicked', (data: unknown) => {
      const { menuId: id, itemIndex } = data as { menuId: string; itemIndex: number };
      if (id !== menuId) return;
      items[itemIndex]?.action();
    });
    return unsubscribe;
  }, [items]);

  function handleTrigger(e: React.MouseEvent) {
    e.stopPropagation();
    const nativeItems = items.map((item) => ({ label: item.label }));
    void window.relay.invoke('menu:show-context-menu', { menuId: menuIdRef.current, items: nativeItems });
    forceUpdate(n => n + 1); // ensure re-render if needed
  }

  return (
    <button
      onClick={handleTrigger}
      className="overflow-menu-btn opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-[var(--color-mac-muted)] hover:text-[var(--color-mac-text)] hover:bg-[var(--color-mac-surface2)] transition-opacity text-xs"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      tabIndex={-1}
      aria-label="More options"
    >
      ⋯
    </button>
  );
}
