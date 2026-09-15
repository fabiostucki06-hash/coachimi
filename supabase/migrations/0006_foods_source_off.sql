-- Creates public.foods (matches supabase/schema.sql's definition) if it
-- doesn't already exist live yet - the "run once" base schema.sql was never
-- actually applied for this table on the live project, which meant Tier 1 of
-- services/foodSearch.ts's searchFoodHybrid (`searchLocal`) always silently
-- failed and fell straight through to FatSecret/USDA, never actually caching
-- anything. Also widens the `source` check to allow 'off', needed because
-- searchFoodHybrid now escalates to Open Food Facts (services/foodApi.ts's
-- searchFood) before FatSecret, and picks from that tier need to be
-- cacheable too (see cacheFoodItem).

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
  source text not null default 'local',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods add constraint foods_source_check
  check (source in ('local', 'fatsecret', 'usda', 'off'));

create index if not exists foods_name_trgm_idx on public.foods using gin (name gin_trgm_ops);

create unique index if not exists foods_source_external_id_idx
  on public.foods (source, external_id) where external_id is not null;

alter table public.foods enable row level security;

-- Same open/anon-friendly pattern as community_barcodes: a food's nutrition
-- facts aren't owned by whoever contributed them, and gating contribution
-- behind login would just mean fewer products ever get cached.
drop policy if exists "Anyone can read foods" on public.foods;
create policy "Anyone can read foods" on public.foods for select using (true);

drop policy if exists "Anyone can cache a food" on public.foods;
create policy "Anyone can cache a food" on public.foods for insert with check (true);

drop policy if exists "Anyone can update a cached food" on public.foods;
create policy "Anyone can update a cached food" on public.foods for update using (true) with check (true);
