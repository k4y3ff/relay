import type { ITheme } from '@xterm/xterm';

export interface AppThemeColors {
  // Surfaces
  bg: string;
  surface: string;
  surface2: string;
  border: string;

  // Text
  text: string;
  textSecondary: string;

  // Accent
  accent: string;
  accentText: string;        // text color on accent-background buttons
  accentHover: string;       // button :hover background color
  accentRowActive: string;   // accent-tinted active row highlight
  accentOverlay: string;     // accent-tinted button hover bg
  accentFocusRing: string;   // :focus-visible outline

  // Per-area backgrounds (can be opaque or semi-transparent)
  titlebarBg: string;
  sidebarBg: string;
  chatPaneBg: string;
  rightColumnBg: string;

  // Diff viewer
  diffAdded: string;
  diffAddedText: string;
  diffAddedBg: string;
  diffAddedLineBg: string;
  diffAddedHighlight: string;
  diffDeleted: string;
  diffDeletedText: string;
  diffDeletedBg: string;
  diffDeletedLineBg: string;
  diffDeletedHighlight: string;
  diffInfoBg: string;
  diffInfoLineBg: string;

  // Semantic
  error: string;

  // Status dots
  statusTodo: string;
  statusInProgress: string;
  statusBlocked: string;
  statusDone: string;
}

export interface AppTheme {
  name: string;
  /** Controls direction of derived hover overlays: white for dark, black for light */
  colorScheme: 'dark' | 'light';
  colors: AppThemeColors;
  /** Default terminal color scheme for all xterm instances */
  terminal: ITheme;
  /** Optional override for the shell pane terminal */
  shellTerminal?: ITheme;
  /** Optional override for Claude Chat tab terminals */
  chatTerminal?: ITheme;
}
