-- Schedules the send-push-reminders edge function three times a day via
-- pg_cron + pg_net (both must already be enabled under Database > Extensions
-- in the Supabase dashboard - pg_cron in particular usually can't be turned
-- on from a migration on hosted projects).
--
-- Manual one-time setup this migration depends on and can't do itself:
--   1. Deploy the function with its own secrets set (see
--      supabase/functions/send-push-reminders/index.ts's header comment):
--        supabase functions deploy send-push-reminders --no-verify-jwt
--        supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...
--        supabase secrets set CRON_SECRET=<a random string>
--   2. Store that same CRON_SECRET in Vault so this SQL can read it back
--      without ever putting the raw secret in a migration file / git history:
--        select vault.create_secret('<the same random string>', 'push_reminders_cron_secret');
--
-- pg_cron on Supabase runs in UTC, so these times are CET (UTC+1) - during
-- CEST (UTC+2, roughly late March-late October) the reminders land an hour
-- later than the label says. Good enough for a best-effort nudge; adjust the
-- three `cron.schedule` times below if that drift ever matters.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'push-reminders-morning',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://nejndycalbepcfmmuiai.supabase.co/functions/v1/send-push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_reminders_cron_secret')
    )
  );
  $$
);

select cron.schedule(
  'push-reminders-midday',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://nejndycalbepcfmmuiai.supabase.co/functions/v1/send-push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_reminders_cron_secret')
    )
  );
  $$
);

select cron.schedule(
  'push-reminders-evening',
  '0 19 * * *',
  $$
  select net.http_post(
    url := 'https://nejndycalbepcfmmuiai.supabase.co/functions/v1/send-push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_reminders_cron_secret')
    )
  );
  $$
);
