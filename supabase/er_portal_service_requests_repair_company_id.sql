-- ER Portal Service Requests company_id repair
-- Run this in the ER Supabase SQL Editor only if approved portal requests still fail
-- with: null value in column "company_id" of relation "tickets".
-- Safe scope: this touches ONLY public.portal_service_requests.
-- It does NOT alter/update/delete public.tickets or public.customers.

-- 1) Make sure the column exists on the portal request table.
alter table if exists public.portal_service_requests
  add column if not exists company_id uuid;

-- 2) Backfill old portal request rows that were created before company_id was added/enforced.
-- Replace this UUID if the ER owner gives a different default company_id.
update public.portal_service_requests
set company_id = 'b86acc43-08df-4ef3-aae0-1653cb5a1fcd'::uuid
where company_id is null;

-- 3) Enforce company_id for future portal request rows.
alter table if exists public.portal_service_requests
  alter column company_id set not null;
