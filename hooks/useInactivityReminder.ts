import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import {
  getInactivityReference,
  getLastMealLoggedAt,
  getNotificationPermission,
  shouldShowInactivityReminder,
  showInactivityNotification,
} from '@/services/notificationService';
import { useDiaryStore } from '@/store/diaryStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useUserStore } from '@/store/userStore';

const CHECK_INTERVAL_MS = 60 * 1000;

// Screens where a nudge would interrupt the very thing being done (logging a
// meal, onboarding) or the OLED widget window. The reminder isn't lost, just
// deferred - the next tick after leaving the screen still fires it, because
// the "already notified" marker below is keyed on the inactivity reference,
// not on the clock.
const SILENCED_PATHS = new Set([
  '/widget',
  '/onboarding',
  '/setup',
  '/add-food',
  '/log-quantity',
  '/barcode-scanner',
  '/analyze-food',
  '/meal-parser',
]);

/**
 * Inactivity nudge, delivered as a native system notification: fires when the
 * reminders switch is on, it's daytime and the newest logged meal (from the
 * diary store, which cloud sync keeps current with Supabase) is more than 4
 * hours old - see shouldShowInactivityReminder for the exact rule.
 *
 * Fires at most once per inactivity reference, so the user gets one banner
 * rather than one a minute until they log something; logging a meal moves the
 * reference, which re-arms it for the next 4-hour gap. Mounted once in the
 * root layout.
 */
export function useInactivityReminder() {
  const enabled = useNotificationStore((state) => state.remindersEnabled);
  const hasOnboarded = useUserStore((state) => state.hasOnboarded);
  const pathname = usePathname();
  const notifiedForRef = useRef<number | null>(null);

  // Read through a ref so the interval doesn't have to be torn down and
  // re-armed on every diary change.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || !hasOnboarded) return;
    if (getNotificationPermission() !== 'granted') return;

    const check = () => {
      if (SILENCED_PATHS.has(pathnameRef.current)) return;

      const now = new Date();
      const lastLoggedAt = getLastMealLoggedAt(useDiaryStore.getState().entriesByDate);
      if (!shouldShowInactivityReminder(now, lastLoggedAt)) return;

      const reference = getInactivityReference(now, lastLoggedAt);
      if (notifiedForRef.current === reference) return;

      notifiedForRef.current = reference;
      void showInactivityNotification(now.getTime() - reference);
    };

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, hasOnboarded]);
}
