-- "Send Plan to Friend": a workout template, copied straight into a friend's
-- shared-plan inbox so they can review it and add it to their own plan
-- library with one tap (services/workoutPlanShares.ts). Same shape as
-- 0002_meal_shares.sql - its own table (not a row in the recipient's
-- `user_data` snapshot) because writing into another user's `user_data` row
-- is (and must stay) impossible under RLS, so an inbox needs a table the
-- SENDER can insert into and the RECIPIENT owns.

create table if not exists public.workout_plan_shares (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  exercises jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists workout_plan_shares_to_user_idx on public.workout_plan_shares (to_user_id, created_at desc);

alter table public.workout_plan_shares enable row level security;

-- Both sides can see a share exists (sender gets a "sent" confirmation, not
-- just a fire-and-forget insert); only the recipient can act on it.
drop policy if exists "Participants can read a workout plan share" on public.workout_plan_shares;
create policy "Participants can read a workout plan share"
  on public.workout_plan_shares for select
  using (auth.uid() = to_user_id or auth.uid() = from_user_id);

-- Sending is gated on an accepted friendship in both directions, same check
-- the meal_shares insert policy uses - a friend id lifted from outside the
-- caller's actual friend list is rejected at the DB, not just skipped client-side.
drop policy if exists "Friends can send a workout plan share" on public.workout_plan_shares;
create policy "Friends can send a workout plan share"
  on public.workout_plan_shares for insert
  with check (
    auth.uid() = from_user_id
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = auth.uid() and f.friend_id = workout_plan_shares.to_user_id)
          or (f.friend_id = auth.uid() and f.user_id = workout_plan_shares.to_user_id))
    )
  );

-- Recipient clears a share from their inbox once they've added it to their
-- plans or dismissed it - there is no "unread/added/dismissed" status column,
-- the inbox is simply whatever rows still exist for to_user_id.
drop policy if exists "Recipients can clear their inbox" on public.workout_plan_shares;
create policy "Recipients can clear their inbox"
  on public.workout_plan_shares for delete
  using (auth.uid() = to_user_id);
