-- ER Portal Service Requests setup
-- Run this in the ER Supabase SQL Editor.
-- Safe scope: this script creates a NEW table only for customer-portal verification requests.
-- It does NOT alter, update, delete, truncate, or drop the existing ER public.tickets table.

create extension if not exists pgcrypto;

create table if not exists public.portal_service_requests (
  id uuid primary key default gen_random_uuid(),

  -- Required company used when the request is approved and inserted into public.tickets.
  company_id uuid not null,

  -- Local portal customer reference. This is from the Admin Hub/USHS portal database.
  -- It is intentionally not a foreign key because it belongs to a different Supabase project.
  portal_customer_profile_id uuid,
  portal_customer_email text,

  -- Request identity / sync tracking.
  request_number text not null unique,
  ticket_source text,
  source_system text not null default 'customer_portal',
  origin_type text,
  er_ticket_id uuid,
  er_ticket_no text,
  last_synced_at timestamptz,

  -- Customer submitted details.
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

  -- Product/request details.
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

  -- Verification state.
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected')),
  verification_reject_reason text,
  verification_notes text,
  verification_reviewed_by text,
  verification_reviewed_at timestamptz,
  is_fake_ticket boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_service_requests_company_idx
  on public.portal_service_requests(company_id, created_at desc);

create index if not exists portal_service_requests_verification_idx
  on public.portal_service_requests(verification_status, created_at desc);

create index if not exists portal_service_requests_customer_profile_idx
  on public.portal_service_requests(portal_customer_profile_id, created_at desc);

create index if not exists portal_service_requests_er_ticket_idx
  on public.portal_service_requests(er_ticket_id)
  where er_ticket_id is not null;

create or replace function public.portal_service_requests_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portal_service_requests_set_updated_at on public.portal_service_requests;
create trigger portal_service_requests_set_updated_at
before update on public.portal_service_requests
for each row execute function public.portal_service_requests_set_updated_at();

-- Keep direct browser access locked down. Your Next.js server uses the ER service role key.
alter table public.portal_service_requests enable row level security;
