import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../context/ThemeContext';
import { THEMES } from '../themes';

interface Props {
  onClose: () => void;
}

const APP_THEMES: { id: string; label: string }[] = [
  { id: 'dark', label: 'Default' },
  { id: 'pink', label: 'Pink' },
];

const EDITOR_THEMES: { id: string; label: string }[] = [
  { id: 'one-dark', label: 'One Dark' },
  { id: 'github-dark', label: 'GitHub Dark' },
  { id: 'github-light', label: 'GitHub Light' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'nord', label: 'Nord' },
  { id: 'solarized-dark', label: 'Solarized Dark' },
  { id: 'solarized-light', label: 'Solarized Light' },
];

export default function SettingsModal({ onClose }: Props) {
  const { theme, setTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean | null>(null);
  const [powerModeEnabled, setPowerModeEnabled] = useState<boolean | null>(null);
  const [editorTheme, setEditorTheme] = useState<string | null>(null);
  const [editorWordWrap, setEditorWordWrap] = useState<boolean | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.relay.invoke('settings:get-notifications-enabled').then((val) => {
      setNotificationsEnabled(val as boolean);
    });
    window.relay.invoke('settings:get-sound-effects-enabled').then((val) => {
      setSoundEffectsEnabled(val as boolean);
    });
    window.relay.invoke('settings:get-power-mode-enabled').then((val) => {
      setPowerModeEnabled(val as boolean);
    });
    window.relay.invoke('settings:get-editor-theme').then((val) => {
      setEditorTheme(val as string);
    });
    window.relay.invoke('settings:get-editor-word-wrap').then((val) => {
      setEditorWordWrap(val as boolean);
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

  function handleSoundToggle() {
    const next = !soundEffectsEnabled;
    setSoundEffectsEnabled(next);
    window.relay.invoke('settings:set-sound-effects-enabled', { enabled: next });
  }

  function handlePowerModeToggle() {
    const next = !powerModeEnabled;
    setPowerModeEnabled(next);
    window.relay.invoke('settings:set-power-mode-enabled', { enabled: next });
    window.dispatchEvent(new CustomEvent('settings:power-mode-changed', { detail: next }));
  }

  function handleWordWrapToggle() {
    const next = !editorWordWrap;
    setEditorWordWrap(next);
    window.relay.invoke('settings:set-editor-word-wrap', { enabled: next });
    window.dispatchEvent(new CustomEvent('settings:editor-word-wrap-changed', { detail: next }));
  }

  function handleThemeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const theme = e.target.value;
    setEditorTheme(theme);
    window.relay.invoke('settings:set-editor-theme', { theme });
    window.dispatchEvent(new CustomEvent('settings:editor-theme-changed', { detail: theme }));
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
          Appearance
        </p>

        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] text-[var(--color-mac-text)]">Theme</span>
          <select
            value={theme.name}
            onChange={(e) => setTheme(THEMES[e.target.value])}
            className="text-[12px] text-[var(--color-mac-text)] bg-[var(--color-mac-surface2)] border border-[var(--color-mac-border)] rounded px-2 py-1 cursor-pointer focus:outline-none"
          >
            {APP_THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

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

        <p className="text-[11px] font-medium text-[var(--color-mac-muted)] uppercase tracking-wide mt-4 mb-2">
          Sound
        </p>

        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[var(--color-mac-text)]">Play sound when Claude finishes</span>
          <button
            role="switch"
            aria-checked={soundEffectsEnabled ?? false}
            onClick={handleSoundToggle}
            disabled={soundEffectsEnabled === null}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none disabled:opacity-50 ${
              soundEffectsEnabled ? 'bg-[var(--color-mac-accent)]' : 'bg-[var(--color-mac-surface2)]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
                soundEffectsEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <p className="text-[11px] font-medium text-[var(--color-mac-muted)] uppercase tracking-wide mt-4 mb-2">
          Power Mode
        </p>

        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[var(--color-mac-text)]">Sparkles while typing</span>
          <button
            role="switch"
            aria-checked={powerModeEnabled ?? false}
            onClick={handlePowerModeToggle}
            disabled={powerModeEnabled === null}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none disabled:opacity-50 ${
              powerModeEnabled ? 'bg-[var(--color-mac-accent)]' : 'bg-[var(--color-mac-surface2)]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
                powerModeEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <p className="text-[11px] font-medium text-[var(--color-mac-muted)] uppercase tracking-wide mt-4 mb-2">
          Editor
        </p>

        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[var(--color-mac-text)]">Syntax theme</span>
          <select
            value={editorTheme ?? ''}
            onChange={handleThemeChange}
            disabled={editorTheme === null}
            className="text-[12px] text-[var(--color-mac-text)] bg-[var(--color-mac-surface2)] border border-[var(--color-mac-border)] rounded px-2 py-1 cursor-pointer disabled:opacity-50 focus:outline-none"
          >
            {EDITOR_THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-[13px] text-[var(--color-mac-text)]">Word wrap</span>
          <button
            role="switch"
            aria-checked={editorWordWrap ?? false}
            onClick={handleWordWrapToggle}
            disabled={editorWordWrap === null}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none disabled:opacity-50 ${
              editorWordWrap ? 'bg-[var(--color-mac-accent)]' : 'bg-[var(--color-mac-surface2)]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
                editorWordWrap ? 'translate-x-4' : 'translate-x-0'
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
