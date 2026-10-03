-- "Send Meal to Friend" (whole meal): every entry of one meal section
-- (Frühstück/Mittagessen/...), copied as a single unit into a friend's
-- shared-meal-group inbox so they can add all of it to their own diary with
-- one tap (services/mealGroupShares.ts). Deliberately a separate table from
-- 0002_meal_shares.sql rather than reusing its one-row-per-food shape: that
-- table's `food_item`/`servings` columns are singular and NOT NULL, so
-- bolting a "this row is actually N items" array onto it would mean two
-- conflicting representations of the same share. Same shape as
-- 0011_workout_plan_shares.sql's `exercises jsonb` for "one row = one
-- shareable unit" otherwise - its own table because writing into another
-- user's `user_data` row is (and must stay) impossible under RLS, so an
-- inbox needs a table the SENDER can insert into and the RECIPIENT owns.

create table if not exists public.meal_group_shares (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  meal_type text not null,
  items jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists meal_group_shares_to_user_idx on public.meal_group_shares (to_user_id, created_at desc);

alter table public.meal_group_shares enable row level security;

-- Both sides can see a share exists (sender gets a "sent" confirmation, not
-- just a fire-and-forget insert); only the recipient can act on it.
drop policy if exists "Participants can read a meal group share" on public.meal_group_shares;
create policy "Participants can read a meal group share"
  on public.meal_group_shares for select
  using (auth.uid() = to_user_id or auth.uid() = from_user_id);

-- Sending is gated on an accepted friendship in both directions, same check
-- meal_shares/workout_plan_shares use - a friend id lifted from outside the
-- caller's actual friend list is rejected at the DB, not just skipped client-side.
drop policy if exists "Friends can send a meal group share" on public.meal_group_shares;
create policy "Friends can send a meal group share"
  on public.meal_group_shares for insert
  with check (
    auth.uid() = from_user_id
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = auth.uid() and f.friend_id = meal_group_shares.to_user_id)
          or (f.friend_id = auth.uid() and f.user_id = meal_group_shares.to_user_id))
    )
  );

-- Recipient clears a share from their inbox once they've added it to their
-- log or dismissed it - there is no "unread/added/dismissed" status column,
-- the inbox is simply whatever rows still exist for to_user_id.
drop policy if exists "Recipients can clear their meal group inbox" on public.meal_group_shares;
create policy "Recipients can clear their meal group inbox"
  on public.meal_group_shares for delete
  using (auth.uid() = to_user_id);
