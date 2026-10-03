// Deno edge function. Scheduled three times a day (08:00 / 13:00 / 20:00
// Europe/Berlin - see the pg_cron jobs in
// supabase/migrations/0010_push_reminders_cron.sql) to push a reminder to
// every stored Web Push subscription (user_push_subscriptions), so meal
// reminders reach users even with the PWA fully closed. The client-side
// setTimeout reminders in services/notificationService.ts cover the
// app-open case; this covers the rest.
//
// Deploy: supabase functions deploy send-push-reminders --no-verify-jwt
// (pg_cron calls this anonymously - see CRON_SECRET below - so the
// platform's own JWT check must be off, or every cron invocation gets
// rejected before this file ever runs).
//
// Required function secrets (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  - generate with `npx web-push generate-vapid-keys`.
//     VAPID_PUBLIC_KEY must match the client's EXPO_PUBLIC_VAPID_PUBLIC_KEY.
//   VAPID_SUBJECT      - "mailto:someone@example.com", required by the push protocol.
//   CRON_SECRET        - shared secret; only the pg_cron job (which reads it
//     from Vault) knows it, so this endpoint can't be used to spam every
//     subscriber by anyone who finds the URL.
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - auto-injected by the platform.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webPush from 'npm:web-push@3.6.7';

interface ReminderPayload {
  title: string;
  body: string;
  url?: string;
  /** Notification tag - see the note below; public/sw.js passes it straight to showNotification. */
  tag: string;
}

// Keyed by the Europe/Berlin hour this function is invoked at. Falls back to
// a generic reminder for any other hour (e.g. a manual/test invocation).
//
// Each slot carries its OWN tag, and those strings are a contract with the
// client: `coachimi-<id>` matches reminderTag() in
// services/notificationService.ts, keyed by the ids in DAILY_REMINDERS. Two
// things depend on that:
//   - Distinct per slot, so the day's second and third reminders show a real
//     system banner instead of silently replacing the first one in the tray
//     (the Notifications spec suppresses re-alerting on a same-tag replace).
//   - Identical to the client's, so when the app happens to be open and its
//     local timer fires the same reminder, the two collapse into one tray
//     entry rather than showing the user a duplicate.
const REMINDERS_BY_HOUR: Record<number, ReminderPayload> = {
  8: { title: 'Coach imi', body: 'Zeit für deinen Protein-Check! Trag dein Frühstück ein.', tag: 'coachimi-breakfast' },
  13: { title: 'Coach imi', body: 'Mikronährstoff-Check: Wie sieht dein Tag bisher aus?', tag: 'coachimi-lunch' },
  20: { title: 'Coach imi', body: 'Tagesrückblick: Vergiss dein Abendessen nicht im Tagebuch.', tag: 'coachimi-dinner' },
};
const DEFAULT_REMINDER: ReminderPayload = { title: 'Coach imi', body: 'Zeit für deinen Makro-Check!', tag: 'coachimi-reminder' };

// Short, varied motivational lines - mixed into the fallback message (nothing
// logged yet today, or no synced goals to compare against) so the three fixed
// daily slots don't read as the exact same banner forever.
const MOTIVATIONAL_QUOTES: string[] = [
  'Kleine Schritte, grosse Wirkung.',
  'Konsistenz schlägt Perfektion - weiter so!',
  'Jede geloggte Mahlzeit bringt dich deinem Ziel näher.',
  'Disziplin heute, Ergebnis morgen.',
  'Du musst nicht perfekt sein, nur dabei bleiben.',
];

function berlinHour(now: Date): number {
  const formatted = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false }).format(now);
  return Number.parseInt(formatted, 10) % 24;
}

// Same local-calendar-day key the client stores diary entries under
// (utils/calendarDates.ts's getLocalDateKey), anchored to Europe/Berlin since
// a server has no per-device timezone to read and that's the zone the cron
// schedule itself already runs in (supabase/migrations/0010_push_reminders_cron.sql).
function berlinDateKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
}

interface SnapshotMealEntry {
  foodItem: { caloriesPerServing: number; macrosPerServing: { protein: number } };
  servings: number;
}

/** The slice of a user's synced user_data.data this function actually reads - everything else in the real snapshot is ignored. */
interface UserSnapshot {
  user?: { dailyCalorieGoal?: number; dailyMacroGoal?: { protein?: number } };
  entriesByDate?: Record<string, SnapshotMealEntry[]>;
}

/**
 * Tailors the fixed per-slot reminder to what this user has actually logged
 * today (read from their synced user_data row - the same snapshot
 * services/cloudSync.ts pushes), instead of sending the same static line to
 * everyone regardless of progress:
 *   - nothing logged yet today -> the slot's own line + a motivational quote
 *   - well short of today's protein goal -> a concrete, actionable protein tip
 *   - already at/over the calorie goal -> a mindful-balance nudge instead of
 *     "log a meal", which would be bad advice at that point
 *   - otherwise (on track, or no synced goals to compare against) -> the
 *     slot's own line + a motivational quote
 * Falls back to the slot's plain default when there's no snapshot at all
 * (never synced, or the row doesn't parse) rather than guessing.
 */
function buildContextualPayload(hour: number, snapshot: UserSnapshot | null): Omit<ReminderPayload, 'tag'> {
  const fallback = REMINDERS_BY_HOUR[hour] ?? DEFAULT_REMINDER;
  const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  const todaysEntries = snapshot?.entriesByDate?.[berlinDateKey(new Date())] ?? [];

  if (!snapshot || todaysEntries.length === 0) {
    return { title: fallback.title, body: `${fallback.body} ${quote}` };
  }

  const kcal = todaysEntries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
  const protein = todaysEntries.reduce((sum, entry) => sum + entry.foodItem.macrosPerServing.protein * entry.servings, 0);
  const calorieGoal = snapshot.user?.dailyCalorieGoal ?? 0;
  const proteinGoal = snapshot.user?.dailyMacroGoal?.protein ?? 0;

  if (proteinGoal > 0 && protein < proteinGoal * 0.5) {
    const remaining = Math.round(proteinGoal - protein);
    return {
      title: fallback.title,
      body: `Erst ${Math.round(protein)}g von ${Math.round(proteinGoal)}g Protein heute - noch ${remaining}g offen. Magerquark, Linsen oder Hähnchenbrust helfen schnell.`,
    };
  }

  if (calorieGoal > 0 && kcal >= calorieGoal) {
    return {
      title: fallback.title,
      body: `Kalorienziel für heute schon erreicht (${Math.round(kcal)}/${Math.round(calorieGoal)} kcal) - den Rest des Tages locker angehen.`,
    };
  }

  return { title: fallback.title, body: `${fallback.body} ${quote}` };
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return new Response('Missing VAPID configuration', { status: 500 });
  }
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Optional test hook: ?user_id=<uuid> restricts the fan-out to one
  // account instead of every stored subscription. Still gated by the same
  // CRON_SECRET check above, so this can't be used to target someone else
  // without the secret.
  const targetUserId = new URL(req.url).searchParams.get('user_id');

  let query = supabase.from('user_push_subscriptions').select('id, user_id, endpoint, p256dh, auth');
  if (targetUserId) query = query.eq('user_id', targetUserId);
  const { data: subscriptions, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const hour = berlinHour(new Date());
  const tag = (REMINDERS_BY_HOUR[hour] ?? DEFAULT_REMINDER).tag;

  // One batched read for every subscriber's synced snapshot (not one query per
  // subscription) so a user's own logged-today data/goals can tailor their
  // reminder. Missing/unparseable rows just fall back to the generic message
  // inside buildContextualPayload - a user who's never synced isn't blocked.
  const userIds = Array.from(new Set((subscriptions ?? []).map((sub) => sub.user_id as string)));
  const snapshotByUserId = new Map<string, UserSnapshot>();
  if (userIds.length > 0) {
    const { data: userDataRows } = await supabase.from('user_data').select('user_id, data').in('user_id', userIds);
    for (const row of userDataRows ?? []) {
      snapshotByUserId.set(row.user_id as string, row.data as UserSnapshot);
    }
  }

  let sent = 0;
  let removed = 0;
  let failed = 0;

  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        const contextual = buildContextualPayload(hour, snapshotByUserId.get(sub.user_id as string) ?? null);
        // Tapping the banner should land on the logging screen, not the
        // dashboard. public/sw.js only honors same-origin in-app routes here,
        // and hooks/useNotificationRouting.ts only opens ones on its allowlist.
        const body = JSON.stringify({ url: '/add-food', tag, ...contextual });
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404/410 = the browser/OS dropped this subscription for good (uninstalled,
        // permission revoked, endpoint expired) - keeping it would just fail forever.
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('user_push_subscriptions').delete().eq('id', sub.id);
          removed++;
        } else {
          failed++;
        }
      }
    }),
  );

  return new Response(JSON.stringify({ sent, removed, failed }), { headers: { 'Content-Type': 'application/json' } });
});
