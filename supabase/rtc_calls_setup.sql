-- WebRTC calling system (v2) for the main/customer Supabase database.
-- Run this once in the MAIN portal database, not in the ER/ah-solutions database.
--
-- This is additive: it does not touch or drop the original call_requests /
-- call_signals tables from supabase/webrtc_call_queue_setup.sql. Those tables
-- and their existing rows are left in place, just no longer used by the app.

create extension if not exists pgcrypto;

do $$ begin
  create type rtc_call_status as enum ('manager_queue', 'assigned', 'accepted', 'missed', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.rtc_calls (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.service_requests(id) on delete set null,
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text,
  phone_number text,
  call_reason text,
  notes text,
  branch text,
  city text,
  state text,
  zip_code text,
  status rtc_call_status not null default 'manager_queue',
  accepted_by_profile_id text,
  accepted_by_name text,
  accepted_by_role text,
  queued_at timestamptz not null default now(),
  accepted_at timestamptz,
  call_started_at timestamptz,
  call_ended_at timestamptz,
  call_duration_seconds integer,
  ended_by_profile_id text,
  ended_reason text,
  staff_joined_at timestamptz,
  customer_joined_at timestamptz,
  last_staff_seen_at timestamptz,
  last_customer_seen_at timestamptz,
  recording_path text,
  recording_mime text,
  recording_uploaded_at timestamptz,
  created_at timestamptz not null default now()
);

-- Safe to re-run: adds the recording columns to a table created before they existed.
alter table public.rtc_calls add column if not exists recording_path text;
alter table public.rtc_calls add column if not exists recording_mime text;
alter table public.rtc_calls add column if not exists recording_uploaded_at timestamptz;

create index if not exists rtc_calls_status_idx on public.rtc_calls(status, queued_at desc);
create index if not exists rtc_calls_branch_idx on public.rtc_calls(branch, status, queued_at desc);
create index if not exists rtc_calls_customer_idx on public.rtc_calls(customer_id, queued_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'call-recordings',
  'call-recordings',
  false,
  83886080,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'video/webm']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.rtc_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.rtc_calls(id) on delete cascade,
  sender_profile_id text not null,
  sender_role text not null check (sender_role in ('customer', 'staff')),
  signal_type text not null check (signal_type in ('ready', 'offer', 'answer', 'ice-candidate', 'hangup')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rtc_signals_call_created_idx on public.rtc_signals(call_id, created_at);

alter table public.rtc_calls enable row level security;
alter table public.rtc_signals enable row level security;

-- The app uses Next.js API routes with the Supabase service-role key for call queue access.
-- Keeping RLS enabled here protects the tables from accidental direct browser access.
