import { Platform } from 'react-native';

import { todayKey, useDiaryStore } from '@/store/diaryStore';
import type { MealEntry, MealType } from '@/types';

// Local (page-scheduled) reminders for the PWA. There's no server to push
// from (static Vercel export), so the schedule lives in setTimeout timers
// that only run while the app is open or its tab is alive in the background.
// A timer that a sleeping device delivers hours late is dropped, not shown -
// see REMINDER_GRACE_MS. Real closed-app delivery needs Web Push (VAPID + a
// backend); public/sw.js already has the `push` handler waiting for it.

export type NotificationPermissionState = NotificationPermission | 'unsupported';

export interface MealReminder {
  id: string;
  hour: number;
  minute: number;
  title: string;
  body: string;
  /** When set, the reminder is skipped on days this meal type is already in the diary. */
  mealType?: MealType;
}

export const DAILY_REMINDERS: readonly MealReminder[] = [
  { id: 'breakfast', hour: 8, minute: 0, title: 'Guten Morgen', body: 'Zeit fürs Frühstück - trag es kurz bei Coach imi ein.', mealType: 'breakfast' },
  { id: 'lunch', hour: 13, minute: 0, title: 'Mittagszeit', body: 'Hast du schon Mittag gegessen? Halte es im Tagebuch fest.', mealType: 'lunch' },
  { id: 'dinner', hour: 20, minute: 0, title: 'Abendessen', body: 'Vergiss dein Abendessen nicht im Tagebuch.', mealType: 'dinner' },
];

/** A reminder that fires later than this after its scheduled time (device slept, tab was frozen) is stale and skipped. */
export const REMINDER_GRACE_MS = 15 * 60 * 1000;

const NOTIFICATION_ICON = '/icon.png';

// --- Permission / display ---

export function isNotificationSupported(): boolean {
  return Platform.OS === 'web' && typeof Notification !== 'undefined';
}

export function getNotificationPermission(): NotificationPermissionState {
  return isNotificationSupported() ? Notification.permission : 'unsupported';
}

/** Must be called from a user gesture (the Settings switch) - browsers ignore or auto-deny prompts otherwise. Resolves with the resulting state and never throws. */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

interface LocalNotification {
  title: string;
  body: string;
  tag: string;
  url?: string;
}

/** Shows through the service worker registration when there is one (required for notifications on Android Chrome and installed iOS PWAs), else a plain `Notification`. Returns whether anything was shown. */
export async function showLocalNotification({ title, body, tag, url = '/' }: LocalNotification): Promise<boolean> {
  if (getNotificationPermission() !== 'granted') return false;
  const options: NotificationOptions = { body, icon: NOTIFICATION_ICON, badge: NOTIFICATION_ICON, tag, data: { url } };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
    return true;
  } catch (error) {
    console.error('[notifications] show failed:', error);
    return false;
  }
}

// --- Daily meal reminders ---

/** The next local `hour:minute` strictly after `from` - today if it hasn't passed yet, otherwise tomorrow. */
export function getNextOccurrence(hour: number, minute: number, from: Date): Date {
  const next = new Date(from);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function isMealLoggedToday(mealType: MealType | undefined): boolean {
  if (!mealType) return false;
  return useDiaryStore.getState().getEntriesForDate(todayKey()).some((entry) => entry.mealType === mealType);
}

/** Schedules one reminder to repeat every day at its time. Returns a function that cancels it. */
export function scheduleMealReminder(reminder: MealReminder): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const arm = (after: Date) => {
    if (cancelled) return;
    const target = getNextOccurrence(reminder.hour, reminder.minute, after);
    timer = setTimeout(() => {
      if (cancelled) return;
      const lateMs = Date.now() - target.getTime();
      if (lateMs <= REMINDER_GRACE_MS && !isMealLoggedToday(reminder.mealType)) {
        void showLocalNotification({ title: reminder.title, body: reminder.body, tag: `coachimi-${reminder.id}` });
      }
      // Re-arm from just past the target so a timer that fires a hair early can't pick the same slot again.
      arm(new Date(Math.max(Date.now(), target.getTime()) + 1));
    }, Math.max(0, target.getTime() - Date.now()));
  };

  arm(new Date());
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

let stopActiveReminders: (() => void) | null = null;

/** Starts the 08:00 / 13:00 / 20:00 schedule (idempotent). Returns the stop function. */
export function startDailyReminders(): () => void {
  stopDailyReminders();
  const cancels = DAILY_REMINDERS.map(scheduleMealReminder);
  stopActiveReminders = () => cancels.forEach((cancel) => cancel());
  return stopDailyReminders;
}

export function stopDailyReminders(): void {
  stopActiveReminders?.();
  stopActiveReminders = null;
}

// --- Inactivity banner ---

export const INACTIVITY_THRESHOLD_MS = 4 * 60 * 60 * 1000;
export const DAYTIME_START_HOUR = 8;
export const DAYTIME_END_HOUR = 21;

/** Epoch ms of the newest `loggedAt` across the whole diary, or null when nothing was ever logged. */
export function getLastMealLoggedAt(entriesByDate: Record<string, MealEntry[]>): number | null {
  let latest: number | null = null;
  for (const entries of Object.values(entriesByDate)) {
    for (const entry of entries) {
      const time = Date.parse(entry.loggedAt);
      if (Number.isFinite(time) && (latest === null || time > latest)) latest = time;
    }
  }
  return latest;
}

/** The moment the inactivity clock counts from: the last logged meal, but never earlier than today's daytime start - a meal from last night doesn't make 08:00 already "overdue". */
export function getInactivityReference(now: Date, lastLoggedAt: number | null): number {
  const daytimeStart = new Date(now);
  daytimeStart.setHours(DAYTIME_START_HOUR, 0, 0, 0);
  return Math.max(lastLoggedAt ?? 0, daytimeStart.getTime());
}

/** True when it's daytime (08:00-21:00 local) and more than 4h have passed since the reference above. */
export function shouldShowInactivityReminder(now: Date, lastLoggedAt: number | null): boolean {
  const hour = now.getHours();
  if (hour < DAYTIME_START_HOUR || hour >= DAYTIME_END_HOUR) return false;
  return now.getTime() - getInactivityReference(now, lastLoggedAt) > INACTIVITY_THRESHOLD_MS;
}
