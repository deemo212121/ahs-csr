-- ER RPC: return one deduplicated row per zip code from location_mgmt_coverage
-- Run this in the ER Supabase SQL Editor.
-- Safe scope:
-- - Creates/replaces one function: public.distinct_location_coverage(uuid)
-- - Read-only. Does NOT alter, insert, update, or delete anything in
--   location_mgmt_coverage or any other table.
-- - Why: location_mgmt_coverage holds many rows per zip code (one per
--   schedule slot/tier, not one per zip) and can run into six figures of
--   rows for a single company. AHS-CSR previously had to page through the
--   whole table 1,000 rows at a time to build one merged zip/city list,
--   which tripped Cloudflare's per-request outbound-request limit. This
--   function does the same "one row per zip" reduction directly in
--   Postgres, so AHS-CSR only needs a single round-trip instead of ~130.

create or replace function public.distinct_location_coverage(p_company_id uuid)
returns table (
  id uuid,
  legacy_id text,
  company_id uuid,
  zip_code text,
  city text,
  location text,
  self_schedule text,
  days_later text,
  tier_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (zip_code)
    id, legacy_id, company_id, zip_code, city, location, self_schedule, days_later, tier_code, created_at, updated_at
  from public.location_mgmt_coverage
  where company_id = p_company_id
    and zip_code is not null
    and zip_code <> ''
  order by zip_code, updated_at desc nulls last;
$$;

grant execute on function public.distinct_location_coverage(uuid) to service_role;
