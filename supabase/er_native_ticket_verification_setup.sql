-- ER Supabase native ticket verification setup
-- Run this in the OTHER TypeScript/ER Supabase SQL Editor.
-- Purpose:
-- 1) Store customer portal submissions in public.portal_ticket_requests first.
-- 2) After approval, the website creates the official action ticket in public.tickets.
-- 3) public.tickets stays the ER system's main ticket/action table.

create extension if not exists pgcrypto;

create or replace function public.set_portal_ticket_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.portal_ticket_requests (
  id uuid primary key default gen_random_uuid(),

  -- This is the profile/user id from YOUR portal database.
  -- It is not a foreign key because your users can stay in your own Supabase.
  portal_customer_profile_id uuid,
  portal_customer_email text,

  request_number text not null unique,
  ticket_source text not null default 'Customer Portal',
  source_system text not null default 'customer_portal',
  origin_type text not null default 'Customer App',

  -- Filled after approval creates/updates the official ER tickets row.
  er_ticket_id uuid,
  er_ticket_no text,
  sync_status text not null default 'local_only'
    check (sync_status in ('local_only', 'pending_er_sync', 'synced_to_er', 'er_imported', 'sync_failed')),
  sync_error text,
  last_synced_at timestamptz,

  full_name text not null,
  phone_number text not null,
  secondary_phone text,
  customer_email text,

  service_address text not null,
  service_address_2 text,
  city text,
  region text,
  state text,
  zip_code text not null,
  landmark text,

  manual_brand text,
  manual_appliance_type text,
  model_number text,
  serial_number text,
  product_model_version text,
  issue_description text,
  special_request text,
  preferred_date date,
  preferred_time text,
  purchase_date date,
  warranty_type text,

  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected')),
  verification_reviewed_by uuid,
  verification_reviewed_at timestamptz,
  verification_reject_reason text,
  verification_notes text,
  is_fake_ticket boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists portal_ticket_requests_set_updated_at on public.portal_ticket_requests;
create trigger portal_ticket_requests_set_updated_at
before update on public.portal_ticket_requests
for each row execute function public.set_portal_ticket_requests_updated_at();

create index if not exists portal_ticket_requests_status_created_idx
  on public.portal_ticket_requests (verification_status, created_at desc);

create index if not exists portal_ticket_requests_customer_idx
  on public.portal_ticket_requests (portal_customer_profile_id, created_at desc);

create index if not exists portal_ticket_requests_sync_idx
  on public.portal_ticket_requests (sync_status, updated_at desc);

-- Add portal/customer-display columns to the existing ER tickets table.
-- These let your website show ER tickets as view-only without needing to edit ER action fields.
do $$
begin
  if to_regclass('public.tickets') is null then
    raise exception 'public.tickets table does not exist. Create/import the ER tickets table first, then run this SQL again.';
  end if;
end $$;

alter table public.tickets add column if not exists portal_request_id uuid;
alter table public.tickets add column if not exists portal_customer_profile_id uuid;
alter table public.tickets add column if not exists portal_customer_name text;
alter table public.tickets add column if not exists portal_customer_phone text;
alter table public.tickets add column if not exists portal_customer_email text;
alter table public.tickets add column if not exists portal_service_address text;
alter table public.tickets add column if not exists portal_service_address_2 text;
alter table public.tickets add column if not exists portal_city text;
alter table public.tickets add column if not exists portal_region text;
alter table public.tickets add column if not exists portal_state text;
alter table public.tickets add column if not exists portal_zip_code text;
alter table public.tickets add column if not exists portal_landmark text;
alter table public.tickets add column if not exists portal_verification_status text;
alter table public.tickets add column if not exists portal_verified_at timestamptz;

-- Required so the app can safely upsert one official ER ticket per portal request.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tickets_portal_request_id_key'
      and conrelid = 'public.tickets'::regclass
  ) then
    alter table public.tickets
      add constraint tickets_portal_request_id_key unique (portal_request_id);
  end if;
end $$;

create index if not exists tickets_portal_customer_profile_idx
  on public.tickets (portal_customer_profile_id, updated_at desc);

create index if not exists tickets_portal_verification_idx
  on public.tickets (portal_verification_status, updated_at desc);
