import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface NotificationState {
  /** The Settings "Push-Mitteilungen" switch - gates every reminder (the daily meal slots and the inactivity nudge), all of which are delivered as the device's own system notifications. Only ever turned on after the browser granted notification permission. */
  remindersEnabled: boolean;
  setRemindersEnabled: (enabled: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      remindersEnabled: false,
      setRemindersEnabled: (enabled) => set({ remindersEnabled: enabled }),
    }),
    {
      name: 'coach-imi-notification-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
