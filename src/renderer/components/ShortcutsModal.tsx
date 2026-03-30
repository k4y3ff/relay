import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  onClose: () => void;
}

const SECTIONS: { heading: string; shortcuts: { keys: string[]; description: string }[] }[] = [
  {
    heading: 'General',
    shortcuts: [
      { keys: ['⌘', ','], description: 'Settings' },
      { keys: ['⌘', '⇧', '/'], description: 'Keyboard shortcuts' },
    ],
  },
  {
    heading: 'Pane Focus',
    shortcuts: [
      { keys: ['⌘', '⇧', 'C'], description: 'Focus Claude chat' },
      { keys: ['⌘', '⇧', 'T'], description: 'Focus terminal' },
      { keys: ['⌘', '⇧', 'G'], description: 'Navigate task groups' },
      { keys: ['⌘', '⇧', 'G', '→', '⌘', 'F'], description: 'Search tasks' },
    ],
  },
  {
    heading: 'File Picker',
    shortcuts: [
      { keys: ['⌘', '⇧', 'D'], description: 'Show Changes tab' },
      { keys: ['⌘', '⇧', 'F'], description: 'Show All Files tab' },
      { keys: ['⌘', '⇧', '['], description: 'Previous tab' },
      { keys: ['⌘', '⇧', ']'], description: 'Next tab' },
    ],
  },
  {
    heading: 'File Editor',
    shortcuts: [
      { keys: ['⌘', 'S'], description: 'Save file' },
    ],
  },
  {
    heading: 'Chat Pane',
    shortcuts: [
      { keys: ['⌘', '⇧', '['], description: 'Previous tab' },
      { keys: ['⌘', '⇧', ']'], description: 'Next tab' },
    ],
  },
  {
    heading: 'Navigation Modes',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Move selection' },
      { keys: ['↵'], description: 'Open file / select task / toggle group' },
      { keys: ['Esc'], description: 'Exit navigation mode' },
    ],
  },
];

export default function ShortcutsModal({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-[var(--color-mac-surface)] border border-[var(--color-mac-border)] rounded-lg shadow-2xl p-5" style={{ width: 340 }}>
        <h2 className="text-[14px] font-semibold text-[var(--color-mac-text)] mb-4">Keyboard Shortcuts</h2>

        {SECTIONS.map((section) => (
          <div key={section.heading} className="mb-4 last:mb-0">
            <p className="text-[11px] font-medium text-[var(--color-mac-muted)] uppercase tracking-wide mb-2">
              {section.heading}
            </p>
            <div className="flex flex-col gap-1">
              {section.shortcuts.map((s) => (
                <div key={s.description} className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--color-mac-text)]">{s.description}</span>
                  <div className="flex items-center gap-0.5">
                    {s.keys.map((key, i) => (
                      <kbd
                        key={i}
                        className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-mac-text)] bg-[var(--color-mac-surface2)] border border-[var(--color-mac-border)]"
                        style={{ minWidth: 22 }}
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
