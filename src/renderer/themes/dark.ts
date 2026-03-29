import type { AppTheme } from './types';

export const darkTheme: AppTheme = {
  name: 'dark',
  colorScheme: 'dark',
  colors: {
    // Surfaces
    bg: '#1e1e1e',
    surface: '#252525',
    surface2: '#2d2d2d',
    border: 'rgba(255, 255, 255, 0.08)',

    // Text
    text: '#e8e8e8',
    textSecondary: '#9a9a9a',

    // Accent
    accent: '#0a84ff',
    accentHover: '#2196ff',
    accentRowActive: 'rgba(0, 122, 255, 0.25)',
    accentOverlay: 'rgba(10, 132, 255, 0.12)',
    accentFocusRing: 'rgba(0, 122, 255, 0.7)',

    // Per-area backgrounds
    titlebarBg: 'rgba(28, 28, 28, 0.95)',
    sidebarBg: 'rgba(32, 32, 32, 0.93)',
    chatPaneBg: 'rgba(30, 30, 30, 0.95)',
    rightColumnBg: 'rgba(30, 30, 30, 0.95)',

    // Diff viewer
    diffAdded: '#4ade80',
    diffAddedText: '#bbf7d0',
    diffAddedBg: 'rgba(74, 222, 128, 0.10)',
    diffAddedLineBg: 'rgba(74, 222, 128, 0.17)',
    diffAddedHighlight: 'rgba(74, 222, 128, 0.32)',
    diffDeleted: '#f87171',
    diffDeletedText: '#fca5a5',
    diffDeletedBg: 'rgba(239, 68, 68, 0.13)',
    diffDeletedLineBg: 'rgba(239, 68, 68, 0.22)',
    diffDeletedHighlight: 'rgba(239, 68, 68, 0.40)',
    diffInfoBg: 'rgba(10, 132, 255, 0.08)',
    diffInfoLineBg: 'rgba(10, 132, 255, 0.13)',

    // Semantic
    error: '#f87171',

    // Status dots
    statusTodo: '#6b7280',
    statusInProgress: '#3b82f6',
    statusBlocked: '#f97316',
    statusDone: '#22c55e',
  },
  terminal: {
    background: '#1e1e1e',
    foreground: '#e8e8e8',
    cursor: '#e8e8e8',
    cursorAccent: '#1e1e1e',
    selectionBackground: 'rgba(255, 255, 255, 0.2)',
    black: '#1e1e1e',
    red: '#f87171',
    green: '#4ade80',
    yellow: '#facc15',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#34d399',
    white: '#e8e8e8',
    brightBlack: '#6b7280',
    brightRed: '#fca5a5',
    brightGreen: '#86efac',
    brightYellow: '#fde047',
    brightBlue: '#93c5fd',
    brightMagenta: '#d8b4fe',
    brightCyan: '#6ee7b7',
    brightWhite: '#f9fafb',
  },
};
