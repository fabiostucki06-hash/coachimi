import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface NotificationState {
  /** The Settings "Push-Mitteilungen" switch - gates every reminder (the daily meal slots and the inactivity nudge), all of which are delivered as the device's own system notifications. Only ever turned on after the browser granted notification permission. */
  remindersEnabled: boolean;
  setRemindersEnabled: (enabled: boolean) => void;
  /**
   * Epoch ms of the inactivity "reference" (hooks/useInactivityReminder.ts)
   * the user was last notified for, or null before the first one. Persisted
   * (not a React ref) specifically so a page reload/hard refresh can't reset
   * it to "never notified" and re-fire the same still-overdue nudge the user
   * may have just seen seconds earlier - a bare in-memory ref used to do
   * exactly that, since a fresh JS runtime has no memory of the previous one.
   */
  lastInactivityNotifiedReference: number | null;
  setLastInactivityNotifiedReference: (reference: number) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      remindersEnabled: false,
      setRemindersEnabled: (enabled) => set({ remindersEnabled: enabled }),
      lastInactivityNotifiedReference: null,
      setLastInactivityNotifiedReference: (reference) => set({ lastInactivityNotifiedReference: reference }),
    }),
    {
      name: 'coach-imi-notification-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
