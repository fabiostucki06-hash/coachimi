import { useEffect } from 'react';
import { Platform } from 'react-native';

import { getNotificationPermission, startDailyReminders } from '@/services/notificationService';
import { useNotificationStore } from '@/store/notificationStore';

/**
 * Runs the daily 08:00 / 13:00 / 20:00 meal reminders while the Settings
 * switch is on. Mounted once in the root layout so the schedule is (re)armed
 * on every app open, not just while the Settings screen is visible. If the
 * user revoked notification permission in the browser since enabling, the
 * switch is flipped back off so Settings never shows a state that isn't true.
 */
export function useReminderScheduler() {
  const enabled = useNotificationStore((state) => state.remindersEnabled);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    if (getNotificationPermission() !== 'granted') {
      useNotificationStore.getState().setRemindersEnabled(false);
      return;
    }
    return startDailyReminders();
  }, [enabled]);
}
