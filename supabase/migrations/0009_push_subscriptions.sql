-- Web Push subscriptions, one row per (user, browser/device) endpoint. The
-- client (services/pushNotificationService.ts) upserts here on `endpoint`
-- whenever it (re)subscribes, so a browser that already has a subscription
-- never ends up with two rows pointing at the same PushManager endpoint. The
-- send-push-reminders edge function reads every row with the service role
-- key (which bypasses RLS) to fan out a push to each subscriber.

create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists user_push_subscriptions_user_id_idx on public.user_push_subscriptions(user_id);

alter table public.user_push_subscriptions enable row level security;

-- Users manage only their own subscriptions. The edge function's service
-- role key bypasses RLS entirely, so it still sees every row regardless of
-- these policies.
create policy "Users can view own push subscriptions"
  on public.user_push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own push subscriptions"
  on public.user_push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own push subscriptions"
  on public.user_push_subscriptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own push subscriptions"
  on public.user_push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);
