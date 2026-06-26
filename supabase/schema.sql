-- USHS TypeScript/Supabase schema
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

do $$ begin
  create type app_role as enum ('customer', 'csr', 'team_leader', 'csr_manager', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type verification_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type sync_status as enum ('local_only', 'pending_er_sync', 'synced_to_er', 'er_imported', 'sync_failed');
exception when duplicate_object then null;
end $$;

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

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text unique,
  supabase_user_id uuid unique,
  role app_role not null default 'customer',
  first_name text not null default '',
  last_name text not null default '',
  email text not null unique,
  phone_number text,
  address text,
  region text,
  city text,
  state text,
  zip_code text,
  profile_image text,
  is_active boolean not null default true,
  max_active_chats integer not null default 5,
  legacy_table text,
  legacy_id integer,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_has_auth_provider check (firebase_uid is not null or supabase_user_id is not null)
);

create index if not exists profiles_firebase_uid_idx on profiles(firebase_uid) where firebase_uid is not null;
create index if not exists profiles_supabase_user_id_idx on profiles(supabase_user_id) where supabase_user_id is not null;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
before update on profiles
for each row execute function set_updated_at();


-- Automatically create a customer profile when a Supabase Auth user signs up.
create or replace function public.handle_new_customer_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  full_name text;
  first_part text;
  last_part text;
begin
  full_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  first_part := coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), '');
  last_part := case
    when position(' ' in trim(full_name)) > 0 then trim(substr(trim(full_name), position(' ' in trim(full_name)) + 1))
    else ''
  end;

  insert into public.profiles (
    supabase_user_id, firebase_uid, role, email, first_name, last_name, phone_number, address, region, city, state, zip_code, is_active
  )
  values (
    new.id,
    null,
    'customer',
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'first_name', ''), first_part),
    coalesce(nullif(new.raw_user_meta_data ->> 'last_name', ''), last_part),
    nullif(new.raw_user_meta_data ->> 'phone_number', ''),
    nullif(new.raw_user_meta_data ->> 'address', ''),
    nullif(new.raw_user_meta_data ->> 'region', ''),
    nullif(new.raw_user_meta_data ->> 'city', ''),
    nullif(new.raw_user_meta_data ->> 'state', ''),
    nullif(new.raw_user_meta_data ->> 'zip_code', ''),
    true
  )
  on conflict (supabase_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_customer_created on auth.users;
create trigger on_auth_customer_created
after insert on auth.users
for each row execute function public.handle_new_customer_auth_user();


create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  logo_url text,
  legacy_id integer unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists brands_set_updated_at on brands;
create trigger brands_set_updated_at
before update on brands
for each row execute function set_updated_at();

create table if not exists appliance_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon_class text,
  sort_order integer not null default 0,
  legacy_id integer unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists appliance_types_set_updated_at on appliance_types;
create trigger appliance_types_set_updated_at
before update on appliance_types
for each row execute function set_updated_at();

create table if not exists job_statuses (
  id uuid primary key default gen_random_uuid(),
  status_name text not null unique,
  color_code text,
  sort_order integer not null default 0,
  legacy_id integer unique,
  created_at timestamptz not null default now()
);

create table if not exists service_areas (
  id uuid primary key default gen_random_uuid(),
  zip_code text not null,
  city text not null,
  state text not null,
  region text not null,
  is_active boolean not null default true,
  legacy_id integer unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (zip_code, city, state, region)
);

drop trigger if exists service_areas_set_updated_at on service_areas;
create trigger service_areas_set_updated_at
before update on service_areas
for each row execute function set_updated_at();

create index if not exists service_areas_zip_code_idx on service_areas (zip_code);
create index if not exists service_areas_city_idx on service_areas (city);
create index if not exists service_areas_region_idx on service_areas (region);
create index if not exists service_areas_lookup_idx on service_areas (zip_code, is_active);

create table if not exists service_requests (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  customer_id uuid references profiles(id) on delete set null,
  request_number text not null unique,
  ticket_source text,
  source_system text,
  origin_type text,
  er_ticket_id text,
  sync_status sync_status not null default 'local_only',
  sync_error text,
  last_synced_at timestamptz,
  manual_ticket_number text,
  brand_id uuid references brands(id) on delete set null,
  manual_brand text,
  appliance_type_id uuid references appliance_types(id) on delete set null,
  manual_appliance_type text,
  model_number text,
  serial_number text,
  product_model_version text,
  full_name text not null,
  phone_number text not null,
  secondary_phone text,
  customer_email text,
  service_address text not null,
  service_address_2 text,
  region text,
  city text,
  state text,
  zip_code text not null,
  landmark text,
  urgency_level text,
  job_status_id uuid references job_statuses(id) on delete set null,
  issue_description text,
  special_request text,
  purchase_date date,
  warranty_type text,
  call_received_date date,
  is_fake_ticket boolean not null default false,
  created_by_profile_id uuid references profiles(id) on delete set null,
  assigned_csr_id uuid references profiles(id) on delete set null,
  handled_by_csr_id uuid references profiles(id) on delete set null,
  preferred_date date,
  preferred_time time,
  preferred_time_slot text,
  is_serviceable boolean not null default true,
  validation_message text,
  requested_at timestamptz not null default now(),
  scheduled_date date,
  completed_date date,
  follow_up_reminder text,
  follow_up_due_at timestamptz,
  in_progress_started_at timestamptz,
  verification_status verification_status not null default 'pending',
  verification_reviewed_by uuid references profiles(id) on delete set null,
  verification_reviewed_at timestamptz,
  verification_reject_reason text,
  verification_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists service_requests_set_updated_at on service_requests;
create trigger service_requests_set_updated_at
before update on service_requests
for each row execute function set_updated_at();

create index if not exists service_requests_customer_idx on service_requests(customer_id);
create index if not exists service_requests_verification_idx on service_requests(verification_status, requested_at desc);
create index if not exists service_requests_sync_idx on service_requests(sync_status, updated_at desc);
create index if not exists service_requests_status_idx on service_requests(job_status_id, updated_at desc);

create table if not exists request_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  job_status_id uuid references job_statuses(id) on delete set null,
  notes text,
  changed_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);



-- Ticket-based customer support messages.
-- Local portal database only. Do not run this in the ER database.
create table if not exists ticket_message_threads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  customer_id uuid references profiles(id) on delete set null,
  request_number text not null,
  er_ticket_id text,
  subject text not null,
  status text not null default 'open',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id)
);

create index if not exists ticket_message_threads_customer_idx on ticket_message_threads(customer_id, last_message_at desc);
create index if not exists ticket_message_threads_request_idx on ticket_message_threads(request_id);

drop trigger if exists ticket_message_threads_set_updated_at on ticket_message_threads;
create trigger ticket_message_threads_set_updated_at
before update on ticket_message_threads
for each row execute function set_updated_at();

create table if not exists ticket_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references ticket_message_threads(id) on delete cascade,
  request_id uuid references service_requests(id) on delete cascade,
  sender_profile_id uuid references profiles(id) on delete set null,
  sender_role app_role,
  sender_name text not null default 'USHS Support',
  message_body text not null,
  message_type text not null default 'user',
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ticket_messages_thread_idx on ticket_messages(thread_id, created_at asc);
create index if not exists ticket_messages_request_idx on ticket_messages(request_id, created_at desc);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  message text,
  type text not null default 'info',
  link text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists csr_teams (
  id uuid primary key default gen_random_uuid(),
  team_name text not null,
  manager_id uuid not null references profiles(id) on delete cascade,
  is_active boolean not null default true,
  last_assigned_at timestamptz,
  legacy_id integer unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists csr_teams_set_updated_at on csr_teams;
create trigger csr_teams_set_updated_at
before update on csr_teams
for each row execute function set_updated_at();

create table if not exists csr_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references csr_teams(id) on delete cascade,
  csr_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_id, csr_id)
);

create table if not exists call_requests (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  request_id uuid references service_requests(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  customer_name text not null,
  customer_email text,
  phone_number text not null,
  notes text,
  call_reason text,
  call_direction call_direction not null default 'inbound',
  team_id uuid references csr_teams(id) on delete set null,
  manager_id uuid references profiles(id) on delete set null,
  assigned_csr_id uuid references profiles(id) on delete set null,
  accepted_by uuid references profiles(id) on delete set null,
  status call_request_status not null default 'manager_queue',
  provider text default 'manual',
  room_token text unique,
  call_mode text not null default 'external_phone',
  browser_call_status browser_call_status not null default 'idle',
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

drop trigger if exists call_requests_set_updated_at on call_requests;
create trigger call_requests_set_updated_at
before update on call_requests
for each row execute function set_updated_at();

create index if not exists call_requests_status_idx on call_requests(status, queued_at desc);
create index if not exists call_requests_assigned_idx on call_requests(assigned_csr_id, accepted_by);

create table if not exists call_logs (
  id uuid primary key default gen_random_uuid(),
  call_request_id uuid references call_requests(id) on delete set null,
  request_id uuid references service_requests(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  customer_email text,
  call_direction call_direction not null default 'inbound',
  csr_id uuid references profiles(id) on delete set null,
  result text not null default 'ended',
  duration_seconds integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);


create table if not exists request_logs (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  legacy_request_id integer,
  request_id uuid references service_requests(id) on delete set null,
  user_id integer,
  profile_id uuid references profiles(id) on delete set null,
  user_role text,
  actor_name text,
  actor_email text,
  actor_role_label text,
  action text not null,
  old_value text,
  new_value text,
  notes text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists request_logs_created_at_idx on request_logs(created_at desc);
create index if not exists request_logs_action_idx on request_logs(action);
create index if not exists request_logs_legacy_request_idx on request_logs(legacy_request_id);

-- Baseline statuses from the PHP system.
insert into job_statuses (status_name, color_code, sort_order, legacy_id)
values
  ('New Request', '#ffc107', 1, 1),
  ('Assigned', '#17a2b8', 2, 2),
  ('In Progress', '#007bff', 3, 3),
  ('Repair Completed', '#28a745', 4, 4),
  ('Cancelled', '#dc3545', 5, 5)
on conflict (status_name) do nothing;

-- Keep RLS enabled for future tightening. Server API routes use the service role key.
alter table profiles enable row level security;
alter table service_requests enable row level security;
alter table notifications enable row level security;
alter table call_requests enable row level security;
alter table brands enable row level security;
alter table appliance_types enable row level security;
alter table request_logs enable row level security;
