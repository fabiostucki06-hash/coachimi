-- Typo-tolerant search for the local `foods` table (Tier 1 of
-- services/foodSearch.ts's searchFoodHybrid, the app's primary/source-of-truth
-- food database). searchLocal() previously ran a bare `ILIKE '%term%'`, which
-- only ever catches exact substrings - a typo like "Koka Kola" never matched
-- an existing "Coca-Cola" row, even though pg_trgm's GIN index
-- (foods_name_trgm_idx) was already in place to support real fuzzy matching.
--
-- This RPC combines pg_trgm's `%` similarity operator (catches typos/
-- misspellings, using pg_trgm.similarity_threshold - default 0.3) with a
-- plain ILIKE fallback (still catches exact substrings that a short/long name
-- might score too low on for the similarity operator alone), ranked by
-- similarity so the closest matches surface first. Purely additive: it only
-- adds a read-only function, no existing rows/columns/policies are touched.

create extension if not exists pg_trgm;

create or replace function public.search_foods_fuzzy(search_query text, match_limit int default 20)
returns setof public.foods
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.foods
  where name % search_query
     or name ilike '%' || search_query || '%'
  order by similarity(name, search_query) desc
  limit match_limit;
$$;

-- Same open/anon-friendly access as the "Anyone can read foods" RLS policy -
-- this function only ever reads, it never bypasses that policy's intent.
grant execute on function public.search_foods_fuzzy(text, int) to anon, authenticated;
