import { createContext, useContext, useEffect, useState } from 'react';
import type { AppTheme, AppThemeColors } from '../themes/types';
import { DEFAULT_THEME, THEMES } from '../themes';

// ── CSS variable derivation ──────────────────────────────────────────────────

function deriveThemeVars(colors: AppThemeColors, colorScheme: 'dark' | 'light'): Record<string, string> {
  const overlay = colorScheme === 'dark' ? '255, 255, 255' : '0, 0, 0';
  return {
    // Core palette
    '--color-bg': colors.bg,
    '--color-surface': colors.surface,
    '--color-surface2': colors.surface2,
    '--color-border': colors.border,
    '--color-text': colors.text,
    '--color-text-secondary': colors.textSecondary,
    '--color-accent': colors.accent,
    '--color-accent-hover': colors.accentHover,
    '--color-accent-row-active': colors.accentRowActive,
    '--color-accent-overlay': colors.accentOverlay,
    '--color-focus-ring': colors.accentFocusRing,

    // Per-area backgrounds
    '--color-titlebar-bg': colors.titlebarBg,
    '--color-sidebar-bg': colors.sidebarBg,
    '--color-chat-pane-bg': colors.chatPaneBg,
    '--color-right-column-bg': colors.rightColumnBg,

    // Derived hover overlays (based on colorScheme direction)
    '--color-hover-overlay': `rgba(${overlay}, 0.05)`,
    '--color-hover-overlay-strong': `rgba(${overlay}, 0.10)`,
    '--color-scrollbar-thumb': `rgba(${overlay}, 0.18)`,
    '--color-scrollbar-thumb-hover': `rgba(${overlay}, 0.28)`,

    // Diff
    '--color-diff-added': colors.diffAdded,
    '--color-diff-added-text': colors.diffAddedText,
    '--color-diff-added-bg': colors.diffAddedBg,
    '--color-diff-added-line-bg': colors.diffAddedLineBg,
    '--color-diff-added-highlight': colors.diffAddedHighlight,
    '--color-diff-deleted': colors.diffDeleted,
    '--color-diff-deleted-text': colors.diffDeletedText,
    '--color-diff-deleted-bg': colors.diffDeletedBg,
    '--color-diff-deleted-line-bg': colors.diffDeletedLineBg,
    '--color-diff-deleted-highlight': colors.diffDeletedHighlight,
    '--color-diff-info-bg': colors.diffInfoBg,
    '--color-diff-info-line-bg': colors.diffInfoLineBg,

    // Semantic
    '--color-error': colors.error,

    // Status dots
    '--color-status-todo': colors.statusTodo,
    '--color-status-in-progress': colors.statusInProgress,
    '--color-status-blocked': colors.statusBlocked,
    '--color-status-done': colors.statusDone,

    // Legacy aliases so existing Tailwind utility classes still resolve
    '--color-mac-bg': colors.bg,
    '--color-mac-surface': colors.surface,
    '--color-mac-surface2': colors.surface2,
    '--color-mac-border': colors.border,
    '--color-mac-text': colors.text,
    '--color-mac-muted': colors.textSecondary,
    '--color-mac-accent': colors.accent,
    '--color-mac-text-secondary': colors.textSecondary,
  };
}

function applyTheme(theme: AppTheme) {
  const vars = deriveThemeVars(theme.colors, theme.colorScheme);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(DEFAULT_THEME);

  useEffect(() => {
    window.relay.invoke('settings:get-app-theme').then((name) => {
      const t = THEMES[name as string] ?? DEFAULT_THEME;
      setThemeState(t);
      applyTheme(t);
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setTheme(t: AppTheme) {
    setThemeState(t);
    window.relay.invoke('settings:set-app-theme', { theme: t.name });
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
