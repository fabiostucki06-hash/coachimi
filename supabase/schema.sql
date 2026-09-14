-- Run this once in the Supabase SQL Editor (https://supabase.com/dashboard/project/nejndycalbepcfmmuiai/sql/new)
-- Stores one JSON snapshot of app state (profile, goals, diary, water, fasting,
-- gamification rewards: Goldbarren/Streaks/Ränge/Schutzschilde) per user.

create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "Users can read their own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert their own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Required for cross-device sync: without this, other signed-in devices
-- never hear about a row change and only catch up on their next app launch.
alter publication supabase_realtime add table public.user_data;

-- Shared cache of barcode -> nutrition-facts lookups (services/foodApi.ts Tier 1),
-- populated automatically whenever a user manually enters a product that Open Food
-- Facts / USDA couldn't resolve, so every future scan of that barcode - by anyone -
-- resolves instantly instead of re-hitting the external APIs. Anonymous-friendly
-- like the rest of this app's local-first design: read and write are open to the
-- anon key rather than scoped to auth.uid(), since a barcode's nutrition facts
-- aren't owned by whoever contributed them and gating contribution behind login
-- would just mean fewer barcodes ever get cached.
create table if not exists public.community_barcodes (
  barcode text primary key,
  name text not null,
  brand text,
  calories_per_100g numeric not null default 0,
  carbs_per_100g numeric not null default 0,
  protein_per_100g numeric not null default 0,
  fat_per_100g numeric not null default 0,
  micronutrients jsonb not null default '{}'::jsonb,
  contributed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_barcodes enable row level security;

create policy "Anyone can read community barcodes"
  on public.community_barcodes for select
  using (true);

create policy "Anyone can contribute a community barcode"
  on public.community_barcodes for insert
  with check (true);

create policy "Anyone can update a community barcode"
  on public.community_barcodes for update
  using (true)
  with check (true);

-- Friends system: public-facing profile row per auth user (id/email always present;
-- username/name/avatar are optional and filled in later from the app). Rows are
-- created client-side on first sign-in (services/friends.ts ensureProfile) rather
-- than via a database trigger, matching this project's "client drives every table"
-- convention (see community_barcodes above) instead of introducing server-side
-- functions this codebase has none of elsewhere.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  username text unique,
  name text,
  avatar_url text,
  is_profile_public boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A profile is readable by its own owner, by anyone if it opted into
-- is_profile_public (this is what makes @username publicly searchable - see
-- services/friends.ts searchUsers), and by an accepted friend even if they
-- later flipped their profile private (so an existing friend's name doesn't
-- disappear from your friends list).
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

create policy "Users can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- One row per requested/accepted/rejected friendship, directional
-- (user_id = requester, friend_id = recipient).
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint friendships_no_self_friend check (user_id <> friend_id),
  constraint friendships_unique_pair unique (user_id, friend_id)
);

alter table public.friendships enable row level security;

-- Both sides of a friendship (requester and recipient) need to see the row:
-- the recipient to find it in their incoming-requests list, the requester to
-- see it went to 'pending'/'accepted' in their own outgoing list.
create policy "Participants can read their friendships"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can send a friend request"
  on public.friendships for insert
  with check (auth.uid() = user_id);

-- Either side may change status (recipient accepts/declines; requester can
-- also flip it, e.g. re-sending after a decline) - scoped narrowly enough
-- that a participant can only ever touch a row they're already part of.
create policy "Participants can update their friendship status"
  on public.friendships for update
  using (auth.uid() = user_id or auth.uid() = friend_id)
  with check (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Participants can delete their friendship"
  on public.friendships for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Make @username mandatory and validated. Backfill first (existing rows predate
-- this being required - services/friends.ts's ensureProfile now always supplies
-- a default 'user_<id prefix>' handle for brand-new rows, so only pre-existing
-- profiles ever hit this branch) using the same generation scheme, then lock the
-- column down. Re-run safe: the update only touches rows still missing a username,
-- and both alters are idempotent (set not null / replace-if-exists).
update public.profiles
set username = 'user_' || substr(replace(id::text, '-', ''), 1, 10)
where username is null;

alter table public.profiles alter column username set not null;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[a-z0-9_]{3,20}$');

-- Extends user_data's existing "owner only" select policy (RLS policies for
-- the same command are OR'd together) so an accepted friend can also read
-- your synced snapshot - this is how the activity feed reads today's macros/
-- workouts, since diary and training entries live inside that JSONB blob
-- rather than their own relational tables (see CloudSnapshot in
-- services/cloudSync.ts). Friendship status is re-checked on every read, so
-- unfriending immediately cuts off access.
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

-- Tier 1 of the hybrid food search (services/foodSearch.ts): the app's own growing
-- food database. Seeded empty and filled two ways - (a) auto-caching, any item a
-- user picks from Tier 2 (FatSecret) or Tier 3 (translated USDA) gets upserted here
-- so the next search for it is instant and free, (b) manual contribution, same
-- open/anon-friendly pattern as community_barcodes above. pg_trgm backs the ILIKE
-- '%term%' search foods.ts runs - a plain btree index can't do that, trigram can.
create extension if not exists pg_trgm;

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  calories_per_100g numeric not null default 0,
  carbs_per_100g numeric not null default 0,
  protein_per_100g numeric not null default 0,
  fat_per_100g numeric not null default 0,
  micronutrients jsonb not null default '{}'::jsonb,
  -- Where the row came from, so a re-cached item never duplicates. 'local' = seeded/manual.
  source text not null default 'local' check (source in ('local', 'fatsecret', 'usda')),
  -- The origin API's own id (FatSecret food_id / USDA fdcId) - null for hand-entered rows.
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists foods_name_trgm_idx on public.foods using gin (name gin_trgm_ops);

-- Re-selecting the same FatSecret/USDA item twice updates the cached row instead of
-- inserting a duplicate - null external_id (local rows) is exempt since NULL never
-- equals NULL in a unique index.
create unique index if not exists foods_source_external_id_idx
  on public.foods (source, external_id) where external_id is not null;

alter table public.foods enable row level security;

create policy "Anyone can read foods"
  on public.foods for select
  using (true);

create policy "Anyone can cache a food"
  on public.foods for insert
  with check (true);

create policy "Anyone can update a cached food"
  on public.foods for update
  using (true)
  with check (true);
