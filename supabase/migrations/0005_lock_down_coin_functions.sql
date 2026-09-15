-- Follow-up to 0004_backend_coins.sql: `revoke ... from public` does not
-- revoke privileges granted directly to the `anon`/`authenticated` roles -
-- Supabase's default privileges grant EXECUTE on every new function in the
-- public schema to those roles directly (not via the PUBLIC pseudo-role), so
-- add_coins/spend_coins were still callable by anonymous (unauthenticated)
-- requests via PostgREST, and handle_new_user (a trigger function - only
-- ever meant to run as `on_auth_user_created`, never callable directly:
-- Postgres itself refuses to invoke a `returns trigger` function outside a
-- trigger context) was needlessly exposed as an RPC too. Caught by
-- mcp__claude_ai_Supabase__get_advisors after applying 0004.

revoke execute on function public.add_coins(integer) from public, anon, authenticated;
revoke execute on function public.spend_coins(integer) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.add_coins(integer) to authenticated;
grant execute on function public.spend_coins(integer) to authenticated;
-- handle_new_user gets no grants at all: the trigger system invokes it
-- directly (no EXECUTE privilege check applies to trigger firing), and
-- nothing else should ever call it.
