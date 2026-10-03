import { Platform } from 'react-native';

import { todayKey, useDiaryStore } from '@/store/diaryStore';
import type { MealEntry, MealType } from '@/types';

// Everything this app calls a "reminder" is delivered as an OS-level
// notification - the system banner/tray entry the device draws itself - never
// as an in-app overlay. Two paths produce them:
//
//   1. Web Push (services/pushNotificationService.ts + the `push` handler in
//      public/sw.js, fed by supabase/functions/send-push-reminders). This is
//      the path that reaches a fully closed app, and the primary one.
//   2. The setTimeout schedule below, which covers the app-open case and the
//      inactivity nudge. A timer that a sleeping device delivers hours late is
//      dropped, not shown - see REMINDER_GRACE_MS.
//
// Both paths route through registration.showNotification() and share the same
// `tag` per reminder slot, so when push and the local timer both fire at
// 08:00 the second one *replaces* the first in the tray instead of stacking a
// duplicate banner. That dedupe is why tags must stay distinct per slot but
// identical across the two paths - REMINDERS_BY_HOUR in the edge function
// sends the very same tag strings.

export type NotificationPermissionState =
  | NotificationPermission
  /** iOS: the Notification API only exists once the PWA is installed to the home screen. */
  | 'needs-install'
  | 'unsupported';

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

/** Tag namespace shared with public/sw.js and the push edge function - see the dedupe note at the top. */
export function reminderTag(id: string): string {
  return `coachimi-${id}`;
}

export const INACTIVITY_REMINDER_TAG = reminderTag('inactivity');

// --- Platform / permission ---

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as "Macintosh"; the touch points give it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** True when running as an installed PWA (home-screen launch) rather than a browser tab. */
function isStandalonePwa(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isNotificationSupported(): boolean {
  return Platform.OS === 'web' && typeof Notification !== 'undefined';
}

/**
 * The current permission, or why notifications can't be used at all.
 * `needs-install` is the iOS case worth calling out in the UI: Safari exposes
 * no Notification API in a plain tab, only to a PWA launched from the home
 * screen (iOS 16.4+), so the fix there is "add to home screen", not "allow in
 * the site settings".
 */
export function getNotificationPermission(): NotificationPermissionState {
  if (isNotificationSupported()) return Notification.permission;
  if (Platform.OS === 'web' && isIos() && !isStandalonePwa()) return 'needs-install';
  return 'unsupported';
}

/** Must be called from a user gesture (the Settings switch) - browsers ignore or auto-deny prompts otherwise. Resolves with the resulting state and never throws. */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  const current = getNotificationPermission();
  if (current !== 'default') return current;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

// --- Display ---

/** `actions` is in the Notifications spec (service-worker notifications only) but missing from TypeScript's DOM lib. */
type SystemNotificationOptions = NotificationOptions & {
  actions?: { action: string; title: string }[];
};

interface LocalNotification {
  title: string;
  body: string;
  tag: string;
  url?: string;
  /** Adds the "Eintragen" quick action - Android/desktop render it on the banner, iOS ignores it. */
  withLogAction?: boolean;
}

/**
 * `navigator.serviceWorker.ready` is the only reliable handle right after a
 * cold load: `getRegistration()` can still resolve `undefined` while the
 * worker is installing, and silently falling back to `new Notification()`
 * there throws on Android Chrome ("Illegal constructor") - that browser only
 * accepts service-worker notifications. Races a timeout so a page with no
 * worker at all (private mode, registration failed) can't hang forever.
 */
async function getNotificationRegistration(timeoutMs = 3000): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration().catch(() => null);
  if (existing) return existing;
  return Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

/**
 * Shows a native system notification (the OS banner + tray entry), never an
 * in-app view. Goes through the service-worker registration whenever there is
 * one - the only form Android Chrome and installed iOS PWAs accept - and
 * falls back to the page-scoped `Notification` constructor only on desktop
 * browsers without a worker. Returns whether anything was shown.
 */
export async function showLocalNotification({ title, body, tag, url = '/', withLogAction = false }: LocalNotification): Promise<boolean> {
  if (getNotificationPermission() !== 'granted') return false;

  const options: SystemNotificationOptions = {
    body,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    tag,
    lang: 'de',
    // Let the OS dismiss it on its own schedule, like any other app's banner.
    requireInteraction: false,
    silent: false,
    data: { url },
    ...(withLogAction ? { actions: [{ action: 'log-meal', title: 'Eintragen' }] } : {}),
  };

  try {
    const registration = await getNotificationRegistration();
    if (registration) {
      await registration.showNotification(title, options);
    } else {
      if (typeof Notification === 'undefined') return false;
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
        void showLocalNotification({
          title: reminder.title,
          body: reminder.body,
          tag: reminderTag(reminder.id),
          url: '/add-food',
          withLogAction: true,
        });
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

// --- Inactivity reminder ---

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

/** "3 Stunden" / "1 Stunde" - the gap wording used in the inactivity notification title. */
export function formatInactivityGap(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  return `${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
}

/** Fires the inactivity nudge as a system banner. Returns whether it was shown. */
export function showInactivityNotification(gapMs: number): Promise<boolean> {
  return showLocalNotification({
    title: `Schon ${formatInactivityGap(gapMs)} nichts eingetragen`,
    body: 'Tippe hier, um deine nächste Mahlzeit zu loggen.',
    tag: INACTIVITY_REMINDER_TAG,
    url: '/add-food',
    withLogAction: true,
  });
}
