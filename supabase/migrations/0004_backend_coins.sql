-- Moves the Goldbarren/coin balance out of the client-computed user_data
-- JSONB blob (services/cloudSync.ts's CloudRewardSnapshot.goldBars) and into
-- its own profiles.coins column, mutated only through the SECURITY DEFINER
-- RPCs below - never a direct client UPDATE. Fixes two live bugs: new
-- accounts showing a random/leftover coin balance (profiles.coins didn't
-- exist, so a fresh signup just kept whatever was last cached in this
-- device's AsyncStorage under the old client-authoritative model - see
-- store/rewardStore.ts), and existing accounts flickering between balances
-- on refresh (the stale local value briefly showing before the debounced
-- cloud pull overwrote it).

alter table public.profiles add column if not exists coins integer not null default 0;

-- ADD COLUMN ... DEFAULT already backfills every existing row, but make the
-- "existing users without a coin count get 0" requirement explicit and safe
-- to re-run.
update public.profiles set coins = 0 where coins is null;

alter table public.profiles drop constraint if exists profiles_coins_non_negative;
alter table public.profiles add constraint profiles_coins_non_negative check (coins >= 0);

-- Row-creation trigger. Every table in this project was populated
-- client-side until now (see schema.sql's comment on `profiles`), which is
-- exactly how a fresh signup could read/display a stale local coin balance
-- before its profile row ever existed remotely (services/friends.ts
-- ensureProfile only runs after the app has already mounted and the user is
-- signed in). This is the project's first server-side function/trigger,
-- added so a new profile - and its coins = 0 starting balance - exists
-- atomically the instant auth.users gets the new row, before any client
-- code runs. services/friends.ts's ensureProfile stays in place as a
-- best-effort fallback (its ignoreDuplicates upsert becomes a no-op once
-- this trigger has already created the row).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, coins)
  values (
    new.id,
    new.email,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 10),
    0
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomic, race-safe balance mutations - the only sanctioned way for the app
-- to change a coin balance (store/coinsStore.ts). Both pin the write to
-- auth.uid() themselves regardless of any id a caller might try to pass in,
-- so a signed-in user can only ever move their own balance, and both do the
-- check-and-update as a single statement so two concurrent spends (e.g. the
-- same account open on two devices) can't both read a stale balance and
-- double-spend it.
create or replace function public.add_coins(p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'p_amount must be positive';
  end if;

  update public.profiles
  set coins = coins + p_amount
  where id = auth.uid()
  returning coins into v_new_balance;

  if v_new_balance is null then
    raise exception 'profile not found for current user';
  end if;

  return v_new_balance;
end;
$$;

create or replace function public.spend_coins(p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'p_amount must be positive';
  end if;

  update public.profiles
  set coins = coins - p_amount
  where id = auth.uid() and coins >= p_amount
  returning coins into v_new_balance;

  if v_new_balance is null then
    raise exception 'insufficient_coins';
  end if;

  return v_new_balance;
end;
$$;

revoke all on function public.add_coins(integer) from public;
revoke all on function public.spend_coins(integer) from public;
grant execute on function public.add_coins(integer) to authenticated;
grant execute on function public.spend_coins(integer) to authenticated;

-- No RLS change needed for reading the balance: "Profiles are readable per
-- privacy settings" (0001_friends_readonly_access.sql) already covers
-- auth.uid() = id, which is all store/coinsStore.ts's fetchCoins needs.
