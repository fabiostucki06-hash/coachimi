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
}

// Keyed by the Europe/Berlin hour this function is invoked at. Falls back to
// a generic reminder for any other hour (e.g. a manual/test invocation).
const REMINDERS_BY_HOUR: Record<number, ReminderPayload> = {
  8: { title: 'Coach imi', body: 'Zeit für deinen Protein-Check! Trag dein Frühstück ein.' },
  13: { title: 'Coach imi', body: 'Mikronährstoff-Check: Wie sieht dein Tag bisher aus?' },
  20: { title: 'Coach imi', body: 'Tagesrückblick: Vergiss dein Abendessen nicht im Tagebuch.' },
};
const DEFAULT_REMINDER: ReminderPayload = { title: 'Coach imi', body: 'Zeit für deinen Makro-Check!' };

function berlinHour(now: Date): number {
  const formatted = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false }).format(now);
  return Number.parseInt(formatted, 10) % 24;
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

  let query = supabase.from('user_push_subscriptions').select('id, endpoint, p256dh, auth');
  if (targetUserId) query = query.eq('user_id', targetUserId);
  const { data: subscriptions, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const payload = REMINDERS_BY_HOUR[berlinHour(new Date())] ?? DEFAULT_REMINDER;
  const body = JSON.stringify({ ...payload, url: '/' });

  let sent = 0;
  let removed = 0;
  let failed = 0;

  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
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
