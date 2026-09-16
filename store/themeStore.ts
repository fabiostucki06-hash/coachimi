import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ColorSchemeMode } from '@/types';

interface ThemeState {
  /** User's explicit Light/Dark/System choice - 'system' follows the OS/browser preference. */
  mode: ColorSchemeMode;
  setMode: (mode: ColorSchemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'coach-imi-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
