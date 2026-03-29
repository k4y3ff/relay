import type { AppTheme } from './types';

// Hot pink hue (H:330°) derived by scaling #FF69B4 (CSS hotpink) down in brightness
// while preserving exact R:G:B ratios — guarantees the same hue as true hot pink.
export const pinkTheme: AppTheme = {
  name: 'pink',
  colorScheme: 'dark',
  colors: {
    // Surfaces — all H:330°, same hue as #FF69B4
    bg: '#8c3a63',       // hotpink @ 55% brightness
    surface: '#a6446f',  // hotpink @ 65% brightness
    surface2: '#bf507e', // hotpink @ 75% brightness
    border: 'rgba(255, 180, 220, 0.22)',

    // Text
    text: '#fff0f8',
    textSecondary: '#f0b8d4',

    // Accent — very light pink so it pops against the vivid bg
    accent: '#ffe0f2',
    accentText: '#7c3256',   // dark pink for readable contrast on light accent bg
    accentHover: '#fff0f8',
    accentRowActive: 'rgba(255, 224, 242, 0.22)',
    accentOverlay: 'rgba(255, 224, 242, 0.12)',
    accentFocusRing: 'rgba(255, 224, 242, 0.65)',

    // Per-area backgrounds
    titlebarBg: 'rgba(124, 50, 86, 0.95)',
    sidebarBg: 'rgba(148, 60, 104, 0.93)',
    chatPaneBg: 'rgba(136, 54, 94, 0.95)',
    rightColumnBg: 'rgba(136, 54, 94, 0.95)',

    // Diff viewer
    diffAdded: '#4ade80',
    diffAddedText: '#bbf7d0',
    diffAddedBg: 'rgba(74, 222, 128, 0.12)',
    diffAddedLineBg: 'rgba(74, 222, 128, 0.20)',
    diffAddedHighlight: 'rgba(74, 222, 128, 0.35)',
    diffDeleted: '#fda4af',
    diffDeletedText: '#fecdd3',
    diffDeletedBg: 'rgba(253, 164, 175, 0.15)',
    diffDeletedLineBg: 'rgba(253, 164, 175, 0.25)',
    diffDeletedHighlight: 'rgba(253, 164, 175, 0.40)',
    diffInfoBg: 'rgba(255, 224, 242, 0.10)',
    diffInfoLineBg: 'rgba(255, 224, 242, 0.16)',

    // Semantic
    error: '#fda4af',

    // Status dots
    statusTodo: '#d4a0b8',
    statusInProgress: '#e879f9',
    statusBlocked: '#fb923c',
    statusDone: '#4ade80',
  },
  terminal: {
    background: '#8c3a63',
    foreground: '#fff0f8',
    cursor: '#ffe0f2',
    cursorAccent: '#8c3a63',
    selectionBackground: 'rgba(255, 224, 242, 0.30)',
    black: '#8c3a63',
    red: '#fda4af',
    green: '#4ade80',
    yellow: '#facc15',
    blue: '#c084fc',
    magenta: '#ffe0f2',
    cyan: '#34d399',
    white: '#fff0f8',
    brightBlack: '#d490b0',
    brightRed: '#fecdd3',
    brightGreen: '#86efac',
    brightYellow: '#fde047',
    brightBlue: '#d8b4fe',
    brightMagenta: '#fff0f8',
    brightCyan: '#6ee7b7',
    brightWhite: '#fff8fc',
  },
};
