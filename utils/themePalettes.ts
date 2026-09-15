import { vars } from 'nativewind';

import type { ThemeId } from '@/types';

interface ThemePalette {
  background: string;
  surface: string;
  surfaceBorder: string;
  primary: string;
}

// Values are "R G B" triplets (no commas) - the format rgb(var(--x) / <alpha-value>)
// in tailwind.config.js expects. `classic` matches the app's original hardcoded
// colors exactly, so owning no theme (or the store not having hydrated yet) never
// causes a visual regression.
export const THEME_PALETTES: Record<ThemeId, ThemePalette> = {
  classic: { background: '18 18 18', surface: '30 30 30', surfaceBorder: '42 42 42', primary: '99 102 241' },
  pure_black: { background: '0 0 0', surface: '10 10 10', surfaceBorder: '26 26 26', primary: '99 102 241' },
  deep_indigo: { background: '10 8 20', surface: '22 18 43', surfaceBorder: '40 32 74', primary: '129 140 248' },
  cyberpunk_neon: { background: '8 8 12', surface: '18 16 28', surfaceBorder: '45 40 60', primary: '34 211 238' },
};

export function getThemeVars(themeId: ThemeId) {
  const palette = THEME_PALETTES[themeId] ?? THEME_PALETTES.classic;
  return vars({
    '--color-background': palette.background,
    '--color-surface': palette.surface,
    '--color-surface-border': palette.surfaceBorder,
    '--color-primary': palette.primary,
  });
}
