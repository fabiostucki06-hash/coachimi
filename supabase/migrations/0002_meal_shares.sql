-- "Send Meal to Friend": a logged meal entry, copied straight into a friend's
-- shared-meal inbox so they can review it and add it to their own diary with
-- one tap (services/mealShares.ts). Idempotent (safe to re-run), same
-- drop-policy-if-exists convention as 0001_friends_readonly_access.sql.
--
-- Deliberately its own table rather than a row appended to the recipient's
-- `user_data` snapshot: writing into another user's `user_data` row is (and
-- must stay) impossible under RLS (see 0001's comment on that table), so an
-- inbox needs a table the SENDER can insert into and the RECIPIENT owns.

create table if not exists public.meal_shares (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  food_item jsonb not null,
  meal_type text not null,
  servings numeric not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists meal_shares_to_user_idx on public.meal_shares (to_user_id, created_at desc);

alter table public.meal_shares enable row level security;

-- Both sides can see a share exists (sender gets a "sent" confirmation, not
-- just a fire-and-forget insert); only the recipient can act on it.
drop policy if exists "Participants can read a meal share" on public.meal_shares;
create policy "Participants can read a meal share"
  on public.meal_shares for select
  using (auth.uid() = to_user_id or auth.uid() = from_user_id);

-- Sending is gated on an accepted friendship in both directions, same check
-- the user_data cross-read policy uses - a friend id lifted from outside the
-- caller's actual friend list is rejected at the DB, not just skipped client-side.
drop policy if exists "Friends can send a meal share" on public.meal_shares;
create policy "Friends can send a meal share"
  on public.meal_shares for insert
  with check (
    auth.uid() = from_user_id
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = auth.uid() and f.friend_id = meal_shares.to_user_id)
          or (f.friend_id = auth.uid() and f.user_id = meal_shares.to_user_id))
    )
  );

-- Recipient clears a share from their inbox once they've added it to their
-- log or dismissed it - there is no "unread/added/dismissed" status column,
-- the inbox is simply whatever rows still exist for to_user_id.
drop policy if exists "Recipients can clear their inbox" on public.meal_shares;
create policy "Recipients can clear their inbox"
  on public.meal_shares for delete
  using (auth.uid() = to_user_id);
