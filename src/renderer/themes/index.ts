export { darkTheme } from './dark';
export { darkTheme as DEFAULT_THEME } from './dark';
export { pinkTheme } from './pink';
export type { AppTheme, AppThemeColors } from './types';

import { darkTheme } from './dark';
import { pinkTheme } from './pink';
import type { AppTheme } from './types';

export const THEMES: Record<string, AppTheme> = {
  dark: darkTheme,
  pink: pinkTheme,
};
