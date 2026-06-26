-- WebRTC Call Queue setup for the main/customer Supabase database.
-- Run this once in the MAIN portal database, not in the ER/ah-solutions database.

create extension if not exists pgcrypto;

do $$ begin
  create type call_request_status as enum ('manager_queue', 'assigned', 'accepted', 'missed', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type browser_call_status as enum ('idle', 'connecting', 'ringing', 'connected', 'ended', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type call_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null;
end $$;

alter type call_request_status add value if not exists 'manager_queue';
alter type call_request_status add value if not exists 'assigned';
alter type call_request_status add value if not exists 'accepted';
alter type call_request_status add value if not exists 'missed';
alter type call_request_status add value if not exists 'completed';
alter type call_request_status add value if not exists 'cancelled';

alter type browser_call_status add value if not exists 'idle';
alter type browser_call_status add value if not exists 'connecting';
alter type browser_call_status add value if not exists 'ringing';
alter type browser_call_status add value if not exists 'connected';
alter type browser_call_status add value if not exists 'ended';
alter type browser_call_status add value if not exists 'failed';

alter type call_direction add value if not exists 'inbound';
alter type call_direction add value if not exists 'outbound';

create table if not exists public.call_requests (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  request_id uuid references public.service_requests(id) on delete set null,
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text,
  phone_number text not null,
  notes text,
  call_reason text,
  call_direction call_direction not null default 'inbound',
  team_id uuid,
  manager_id uuid,
  assigned_csr_id uuid,
  accepted_by uuid,
  status call_request_status not null default 'manager_queue',
  provider text default 'metered_turn',
  room_token text unique,
  room_name text,
  call_mode text not null default 'browser_webrtc',
  browser_call_status browser_call_status not null default 'idle',
  branch text,
  city text,
  state text,
  zip_code text,
  source_page text default 'customer_portal',
  accepted_by_profile_id text,
  accepted_by_firebase_uid text,
  accepted_by_name text,
  accepted_by_role text,
  staff_joined_at timestamptz,
  customer_joined_at timestamptz,
  last_staff_seen_at timestamptz,
  last_customer_seen_at timestamptz,
  ended_by_profile_id text,
  ended_reason text,
  queued_at timestamptz not null default now(),
  assigned_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  call_started_at timestamptz,
  call_ended_at timestamptz,
  call_duration_seconds integer,
  recording_path text,
  recording_mime text,
  recording_uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.call_requests add column if not exists branch text;
alter table public.call_requests add column if not exists city text;
alter table public.call_requests add column if not exists state text;
alter table public.call_requests add column if not exists zip_code text;
alter table public.call_requests add column if not exists source_page text default 'customer_portal';
alter table public.call_requests add column if not exists room_name text;
alter table public.call_requests add column if not exists accepted_by_profile_id text;
alter table public.call_requests add column if not exists accepted_by_firebase_uid text;
alter table public.call_requests add column if not exists accepted_by_name text;
alter table public.call_requests add column if not exists accepted_by_role text;
alter table public.call_requests add column if not exists staff_joined_at timestamptz;
alter table public.call_requests add column if not exists customer_joined_at timestamptz;
alter table public.call_requests add column if not exists last_staff_seen_at timestamptz;
alter table public.call_requests add column if not exists last_customer_seen_at timestamptz;
alter table public.call_requests add column if not exists ended_by_profile_id text;
alter table public.call_requests add column if not exists ended_reason text;
alter table public.call_requests add column if not exists call_started_at timestamptz;
alter table public.call_requests add column if not exists call_ended_at timestamptz;
alter table public.call_requests add column if not exists call_duration_seconds integer;
alter table public.call_requests add column if not exists recording_path text;
alter table public.call_requests add column if not exists recording_mime text;
alter table public.call_requests add column if not exists recording_uploaded_at timestamptz;

alter table public.call_requests alter column provider set default 'metered_turn';
alter table public.call_requests alter column call_mode set default 'browser_webrtc';

create index if not exists call_requests_status_idx on public.call_requests(status, queued_at desc);
create index if not exists call_requests_branch_idx on public.call_requests(branch, status, queued_at desc);
create index if not exists call_requests_customer_idx on public.call_requests(customer_id, queued_at desc);
create index if not exists call_requests_staff_key_idx on public.call_requests(accepted_by_profile_id, queued_at desc);

create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_request_id uuid not null references public.call_requests(id) on delete cascade,
  sender_profile_id text not null,
  sender_role text not null check (sender_role in ('customer', 'staff')),
  signal_type text not null check (signal_type in ('ready', 'offer', 'answer', 'ice-candidate', 'hangup')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists call_signals_call_created_idx on public.call_signals(call_request_id, created_at);
create index if not exists call_signals_sender_idx on public.call_signals(sender_profile_id, created_at desc);

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

alter table public.call_requests enable row level security;
alter table public.call_signals enable row level security;

-- The app uses Next.js API routes with the Supabase service-role key for call queue access.
-- Keeping RLS enabled here protects the tables from accidental direct browser access.
