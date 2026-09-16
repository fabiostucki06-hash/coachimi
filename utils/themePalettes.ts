import { vars } from 'nativewind';

import type { ResolvedColorScheme } from '@/hooks/useResolvedColorScheme';
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
// causes a visual regression. These are the *dark*-mode backgrounds - Coin Shop
// skins are dark-only aesthetic variants, so a light-mode user sees LIGHT_PALETTE's
// background/surface/surfaceBorder regardless of which skin they own, but keeps
// that skin's accent (primary) either way.
export const THEME_PALETTES: Record<ThemeId, ThemePalette> = {
  classic: { background: '15 23 42', surface: '30 41 59', surfaceBorder: '51 65 85', primary: '99 102 241' },
  pure_black: { background: '0 0 0', surface: '10 10 10', surfaceBorder: '26 26 26', primary: '99 102 241' },
  deep_indigo: { background: '10 8 20', surface: '22 18 43', surfaceBorder: '40 32 74', primary: '129 140 248' },
  cyberpunk_neon: { background: '8 8 12', surface: '18 16 28', surfaceBorder: '45 40 60', primary: '34 211 238' },
};

// Text/overlay tokens for dark mode reproduce today's hardcoded `text-white` /
// `bg-white/NN` look exactly, so switching a fresh install's default ('system',
// which resolves to 'dark' on most devices/browsers today) in is a no-op visually.
const DARK_FOREGROUND = '248 250 252'; // #F8FAFC
const DARK_OVERLAY = '255 255 255';

const LIGHT_PALETTE = {
  background: '255 255 255', // #FFFFFF
  surface: '248 250 252', // #F8FAFC
  surfaceBorder: '226 232 240', // #E2E8F0 (slate-200)
  foreground: '15 23 42', // #0F172A
  foregroundSecondary: '71 85 105', // #475569 (slate-600)
  overlay: '15 23 42', // dark tint, so bg-overlay/5 etc. read as a soft shadow on a light surface
};

const DARK_FOREGROUND_SECONDARY = '161 161 170'; // #A1A1AA

export function getThemeVars(themeId: ThemeId, resolvedScheme: ResolvedColorScheme) {
  const skin = THEME_PALETTES[themeId] ?? THEME_PALETTES.classic;

  if (resolvedScheme === 'light') {
    return vars({
      '--color-background': LIGHT_PALETTE.background,
      '--color-surface': LIGHT_PALETTE.surface,
      '--color-surface-border': LIGHT_PALETTE.surfaceBorder,
      '--color-foreground': LIGHT_PALETTE.foreground,
      '--color-foreground-secondary': LIGHT_PALETTE.foregroundSecondary,
      '--color-overlay': LIGHT_PALETTE.overlay,
      '--color-primary': skin.primary,
    });
  }

  return vars({
    '--color-background': skin.background,
    '--color-surface': skin.surface,
    '--color-surface-border': skin.surfaceBorder,
    '--color-foreground': DARK_FOREGROUND,
    '--color-foreground-secondary': DARK_FOREGROUND_SECONDARY,
    '--color-overlay': DARK_OVERLAY,
    '--color-primary': skin.primary,
  });
}
