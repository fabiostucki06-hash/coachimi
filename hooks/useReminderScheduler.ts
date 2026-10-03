import { useEffect } from 'react';
import { Platform } from 'react-native';

import { getNotificationPermission, startDailyReminders } from '@/services/notificationService';
import { subscribeUserToPush } from '@/services/pushNotificationService';
import { useNotificationStore } from '@/store/notificationStore';

/**
 * Runs the daily 08:00 / 13:00 / 20:00 meal reminders while the Settings
 * switch is on. Mounted once in the root layout so the schedule is (re)armed
 * on every app open, not just while the Settings screen is visible. If the
 * user revoked notification permission in the browser since enabling, the
 * switch is flipped back off so Settings never shows a state that isn't true.
 *
 * Re-upserts the Web Push subscription on the same trigger. Browsers rotate a
 * PushManager endpoint on their own (storage pressure, a long gap between
 * visits, an OS-side push-service reset), and once the stored endpoint is
 * stale the edge function's sends just 410 into the void - the user quietly
 * stops getting banners with the switch still showing "on". Subscribing is
 * idempotent and reuses the existing subscription, so this costs one upsert
 * per app open and keeps the server's copy current.
 */
export function useReminderScheduler() {
  const enabled = useNotificationStore((state) => state.remindersEnabled);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    if (getNotificationPermission() !== 'granted') {
      useNotificationStore.getState().setRemindersEnabled(false);
      return;
    }
    void subscribeUserToPush();
    return startDailyReminders();
  }, [enabled]);
}
