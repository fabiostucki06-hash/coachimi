import { colorScheme as nativewindColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useThemeStore } from '@/store/themeStore';

export type ResolvedColorScheme = 'light' | 'dark';

/**
 * Resolves the user's Light/Dark/System preference (store/themeStore.ts) against the
 * OS-level scheme, and keeps NativeWind's own `dark:` class variant (used by a couple of
 * components, e.g. CloudSyncCard's error banner) in sync with the same result - so a
 * component can use either plain `dark:` classes or the CSS-var tokens (bg-background,
 * text-foreground, ...) driven by utils/themePalettes.ts and get the same answer.
 */
export function useResolvedColorScheme(): ResolvedColorScheme {
  const mode = useThemeStore((state) => state.mode);
  const systemScheme = useSystemColorScheme();
  const resolved: ResolvedColorScheme = mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;

  useEffect(() => {
    nativewindColorScheme.set(mode);
  }, [mode]);

  return resolved;
}
