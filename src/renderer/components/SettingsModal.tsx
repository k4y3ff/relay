import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.relay.invoke('settings:get-notifications-enabled').then((val) => {
      setNotificationsEnabled(val as boolean);
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleToggle() {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    window.relay.invoke('settings:set-notifications-enabled', { enabled: next });
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={handleOverlayClick}
    >
      <div className="bg-[var(--color-mac-surface)] border border-[var(--color-mac-border)] rounded-lg shadow-2xl p-5 w-72">
        <h2 className="text-[14px] font-semibold text-[var(--color-mac-text)] mb-4">Settings</h2>

        <p className="text-[11px] font-medium text-[var(--color-mac-muted)] uppercase tracking-wide mb-2">
          Notifications
        </p>

        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[var(--color-mac-text)]">Notify when Claude finishes</span>
          <button
            role="switch"
            aria-checked={notificationsEnabled ?? false}
            onClick={handleToggle}
            disabled={notificationsEnabled === null}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none disabled:opacity-50 ${
              notificationsEnabled ? 'bg-[var(--color-mac-accent)]' : 'bg-[var(--color-mac-surface2)]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
                notificationsEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex justify-end mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] rounded text-[var(--color-mac-muted)] hover:text-[var(--color-mac-text)] hover:bg-[var(--color-mac-surface2)] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
