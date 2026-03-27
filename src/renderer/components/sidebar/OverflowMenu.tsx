import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  label: string;
  danger?: boolean;
  action: () => void;
}

interface OverflowMenuProps {
  items: MenuItem[];
}

export default function OverflowMenu({ items }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleTrigger(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current!.getBoundingClientRect();
    setPos({ x: rect.left, y: rect.bottom + 4 });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      e.stopPropagation();
      setOpen(false);
    }
    document.addEventListener('click', onClickOutside, { capture: true });
    return () => document.removeEventListener('click', onClickOutside, { capture: true });
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleTrigger}
        className="overflow-menu-btn opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-[var(--color-mac-muted)] hover:text-[var(--color-mac-text)] hover:bg-[var(--color-mac-surface2)] transition-opacity text-xs -webkit-app-region-no-drag"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        tabIndex={-1}
        aria-label="More options"
      >
        ⋯
      </button>
      {open &&
        createPortal(
          <div
            className="fixed z-50 min-w-[160px] rounded-md overflow-hidden shadow-xl border border-[var(--color-mac-border)] bg-[#2a2a2a] py-1"
            style={{ left: pos.x, top: pos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setOpen(false);
                  item.action();
                }}
                className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-[var(--color-mac-surface2)] transition-colors ${
                  item.danger ? 'text-red-400' : 'text-[var(--color-mac-text)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
