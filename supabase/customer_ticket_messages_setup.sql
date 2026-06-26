-- Customer Ticket Messages setup
-- Run this in YOUR website Supabase database, not in the ER Supabase database.
-- This adds local chat/message tables only. It does not change the ER database.

create extension if not exists pgcrypto;

create table if not exists public.ticket_message_threads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  request_number text not null,
  er_ticket_id text,
  subject text not null,
  status text not null default 'open',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id)
);

create index if not exists ticket_message_threads_customer_idx
  on public.ticket_message_threads(customer_id, last_message_at desc);

create index if not exists ticket_message_threads_request_idx
  on public.ticket_message_threads(request_id);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ticket_message_threads(id) on delete cascade,
  request_id uuid references public.service_requests(id) on delete cascade,
  sender_profile_id uuid references public.profiles(id) on delete set null,
  sender_role public.app_role,
  sender_name text not null default 'USHS Support',
  message_body text not null,
  message_type text not null default 'user',
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ticket_messages_thread_idx
  on public.ticket_messages(thread_id, created_at asc);

create index if not exists ticket_messages_request_idx
  on public.ticket_messages(request_id, created_at desc);

drop trigger if exists ticket_message_threads_set_updated_at on public.ticket_message_threads;
create trigger ticket_message_threads_set_updated_at
before update on public.ticket_message_threads
for each row execute function public.set_updated_at();

-- ER ticket message support
-- This keeps all chat data in YOUR Supabase while allowing threads to reference ER tickets.
-- Safe to run after the original message setup. It does not change ER tables.

alter table public.ticket_message_threads
  alter column request_id drop not null;

alter table public.ticket_message_threads
  add column if not exists er_ticket_no text,
  add column if not exists er_customer_id text,
  add column if not exists source_system text default 'local_verified_ticket',
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists service_address text,
  add column if not exists service_city text,
  add column if not exists service_state text,
  add column if not exists service_zip text,
  add column if not exists manufacturer text,
  add column if not exists product_type text,
  add column if not exists model_number text,
  add column if not exists serial_number text,
  add column if not exists schedule_date text,
  add column if not exists ticket_status text;

create unique index if not exists ticket_message_threads_er_ticket_unique_idx
  on public.ticket_message_threads(er_ticket_id)
  where er_ticket_id is not null;

create index if not exists ticket_message_threads_er_customer_idx
  on public.ticket_message_threads(er_customer_id);

create index if not exists ticket_message_threads_source_idx
  on public.ticket_message_threads(source_system, last_message_at desc);

-- Customer-to-ER matching support
-- This is still LOCAL/your Supabase only. It does not change ER database.
-- A single website customer can match multiple ER customer IDs because ER may have duplicate customer rows from manual/Discord ticketing.

create table if not exists public.customer_er_links (
  id uuid primary key default gen_random_uuid(),
  local_customer_id uuid not null references public.profiles(id) on delete cascade,
  er_customer_id text not null,
  er_customer_name text,
  er_customer_phone text,
  er_customer_second_phone text,
  er_customer_email text,
  er_customer_city text,
  er_customer_state text,
  er_customer_zip text,
  match_method text not null default 'phone',
  match_confidence text not null default 'medium',
  match_score integer not null default 0,
  matched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (local_customer_id, er_customer_id)
);

create index if not exists customer_er_links_local_customer_idx
  on public.customer_er_links(local_customer_id);

create index if not exists customer_er_links_er_customer_idx
  on public.customer_er_links(er_customer_id);

create index if not exists customer_er_links_match_method_idx
  on public.customer_er_links(match_method, match_confidence);

drop trigger if exists customer_er_links_set_updated_at on public.customer_er_links;
create trigger customer_er_links_set_updated_at
before update on public.customer_er_links
for each row execute function public.set_updated_at();

-- Optional local bridge for website-created verified tickets and ER tickets.
-- Website-created tickets can still show in the customer's portal even when ER tickets.customer_id is null.
create table if not exists public.ticket_er_links (
  id uuid primary key default gen_random_uuid(),
  local_customer_id uuid references public.profiles(id) on delete cascade,
  local_request_id uuid references public.service_requests(id) on delete cascade,
  er_ticket_id text not null,
  er_ticket_no text,
  er_customer_id text,
  link_type text not null default 'local_verified_request',
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (local_customer_id, er_ticket_id)
);

create index if not exists ticket_er_links_local_customer_idx
  on public.ticket_er_links(local_customer_id);

create index if not exists ticket_er_links_er_ticket_idx
  on public.ticket_er_links(er_ticket_id);

create index if not exists ticket_er_links_local_request_idx
  on public.ticket_er_links(local_request_id);

drop trigger if exists ticket_er_links_set_updated_at on public.ticket_er_links;
create trigger ticket_er_links_set_updated_at
before update on public.ticket_er_links
for each row execute function public.set_updated_at();
