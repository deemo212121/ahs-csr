-- Run this in the OTHER TypeScript project's Supabase SQL editor
-- if you want this website to sync approved verification tickets directly into that ER database.

create extension if not exists pgcrypto;

create table if not exists portal_verified_tickets (
  id uuid primary key default gen_random_uuid(),
  portal_request_id uuid not null unique,
  portal_request_number text not null,
  source_system text not null default 'customer_portal',
  ticket_status text not null default 'new',
  customer_name text not null,
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
  appliance_type text,
  brand text,
  model_number text,
  serial_number text,
  product_model_version text,
  issue_description text,
  special_request text,
  preferred_date date,
  preferred_time time,
  purchase_date date,
  warranty_type text,
  verification_status text not null default 'approved',
  verified_at timestamptz,
  er_ticket_id text,
  sync_payload jsonb not null,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_verified_tickets_status_idx
  on portal_verified_tickets(ticket_status, received_at desc);

create index if not exists portal_verified_tickets_portal_number_idx
  on portal_verified_tickets(portal_request_number);

create or replace function portal_verified_tickets_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portal_verified_tickets_set_updated_at_trigger on portal_verified_tickets;
create trigger portal_verified_tickets_set_updated_at_trigger
before update on portal_verified_tickets
for each row execute function portal_verified_tickets_set_updated_at();
