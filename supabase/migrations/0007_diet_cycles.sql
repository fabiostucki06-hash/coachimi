-- Diet Cycle / Period tracking (Keto phase, Cheat/Refeed period, ...). Client
-- generates `id` itself (a real UUID - see store/cycleStore.ts's makeCycleId)
-- rather than relying on the column default, so a cycle created offline keeps
-- the exact same id once it syncs here - no local/remote id reconciliation
-- needed (see store/cycleStore.ts's merge logic).
create table if not exists public.diet_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null default 'custom' check (type in ('strict', 'cheat', 'maintenance', 'custom')),
  start_date date not null,
  end_date date not null,
  target_disabled boolean not null default false,
  target_overrides jsonb,
  created_at timestamptz not null default now(),
  constraint diet_cycles_date_range check (end_date >= start_date)
);

create index if not exists diet_cycles_user_id_idx on public.diet_cycles (user_id);

alter table public.diet_cycles enable row level security;

create policy "Users can read their own diet cycles"
  on public.diet_cycles for select
  using (auth.uid() = user_id);

create policy "Users can create their own diet cycles"
  on public.diet_cycles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own diet cycles"
  on public.diet_cycles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own diet cycles"
  on public.diet_cycles for delete
  using (auth.uid() = user_id);

-- Cross-device sync (a cycle added on one device should show up on another
-- without waiting for the next full app relaunch) - same mechanism
-- user_data already uses, see services/cloudSync.ts's subscribeToRemoteChanges.
alter publication supabase_realtime add table public.diet_cycles;
