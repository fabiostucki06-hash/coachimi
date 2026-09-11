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
