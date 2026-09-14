-- Read-only social layer for friends: friendships/profiles/user_data RLS.
--
-- Idempotent (safe to re-run): every policy is dropped by name before being
-- recreated, unlike the plain `create policy` statements in supabase/schema.sql
-- which error on a second run. Written after discovering the live database's
-- user_data table was missing the accepted-friends SELECT policy entirely
-- (only had owner-scoped policies, plus a few duplicate ones from repeated
-- manual schema.sql pastes), which silently broke the friend activity
-- feed/profile view - RLS just returned zero rows rather than erroring.
--
-- Model: this app stores per-user diary/training/etc. data as one JSONB
-- snapshot per row in `user_data` (see services/cloudSync.ts CloudSnapshot),
-- not as separate daily_logs/food_entries tables, so the "all logged daily
-- data and food entries for a friend" read policy lives on user_data.

alter table public.friendships enable row level security;
alter table public.profiles enable row level security;
alter table public.user_data enable row level security;

-- friendships: both participants can read/insert/update/delete their own
-- rows; no one else has any access (RLS default-denies unmatched commands).
drop policy if exists "Participants can read their friendships" on public.friendships;
drop policy if exists "Users can view their own friendships" on public.friendships;
create policy "Participants can read their friendships"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "Users can send a friend request" on public.friendships;
drop policy if exists "Users can insert friendship requests" on public.friendships;
create policy "Users can send a friend request"
  on public.friendships for insert
  with check (auth.uid() = user_id);

drop policy if exists "Participants can update their friendship status" on public.friendships;
drop policy if exists "Users can update their received requests" on public.friendships;
create policy "Participants can update their friendship status"
  on public.friendships for update
  using (auth.uid() = user_id or auth.uid() = friend_id)
  with check (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "Participants can delete their friendship" on public.friendships;
drop policy if exists "Users can delete their friendships" on public.friendships;
create policy "Participants can delete their friendship"
  on public.friendships for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- profiles: own row, any public profile, or an accepted friend's row
-- (so an existing friend's name doesn't vanish if they later go private).
-- Writes stay owner-only.
drop policy if exists "Profiles are readable per privacy settings" on public.profiles;
create policy "Profiles are readable per privacy settings"
  on public.profiles for select
  using (
    auth.uid() = id
    or is_profile_public = true
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = auth.uid() and f.friend_id = profiles.id)
          or (f.friend_id = auth.uid() and f.user_id = profiles.id))
    )
  );

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- user_data: this is the policy that was missing live. Own row, or an
-- accepted friend's row - re-checked on every read, so unfriending cuts
-- off access immediately. Writes stay owner-only (auth.uid() = user_id);
-- UPDATE/INSERT/DELETE on a friend's row is never granted by any policy,
-- so it is strictly forbidden (RLS default-denies unmatched commands).
--
-- Drops every variant name found in the live DB (some duplicated across
-- manual schema.sql re-pastes) before recreating a single clean set.
drop policy if exists "Users can read their own data" on public.user_data;
drop policy if exists "Users can view their own data" on public.user_data;
create policy "Users can read their own data"
  on public.user_data for select
  using (auth.uid() = user_id);

drop policy if exists "Accepted friends can read each other's synced data" on public.user_data;
create policy "Accepted friends can read each other's synced data"
  on public.user_data for select
  using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = auth.uid() and f.friend_id = user_data.user_id)
          or (f.friend_id = auth.uid() and f.user_id = user_data.user_id))
    )
  );

drop policy if exists "Users can insert their own data" on public.user_data;
create policy "Users can insert their own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own data" on public.user_data;
create policy "Users can update their own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Owner-only ALL-command policies from earlier manual pastes are strictly
-- redundant with (and no broader than) the split SELECT/INSERT/UPDATE
-- policies above, so they're dropped rather than kept alongside them.
drop policy if exists "Users can insert/update their own data" on public.user_data;
drop policy if exists "Users can manage their own data" on public.user_data;
