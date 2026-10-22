import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface DisplayPrefsState {
  /** Whether the profile screen shows the "Gewichtsverlauf" card (chart, trend, weight entry). */
  showWeightTrend: boolean;
  setShowWeightTrend: (show: boolean) => void;
}

/**
 * Purely visual, per-device layout choices. Persisted locally (AsyncStorage ->
 * localStorage on web) rather than in the synced user profile, same as the
 * Light/Dark choice in store/themeStore.ts.
 */
export const useDisplayPrefsStore = create<DisplayPrefsState>()(
  persist(
    (set) => ({
      showWeightTrend: true,
      setShowWeightTrend: (show) => set({ showWeightTrend: show }),
    }),
    {
      name: 'coach-imi-display-prefs-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
