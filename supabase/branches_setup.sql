-- Editable branch list, replacing the hardcoded array in src/lib/branches.ts.
-- Run this in the main AHS-CSR Supabase project's SQL Editor (not ER).
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists branches_sort_order_idx on public.branches(sort_order);

alter table public.branches enable row level security;

-- Seed with the existing hardcoded list, in the same order, so nothing
-- changes for anyone until an admin actually edits the list.
insert into public.branches (name, sort_order)
values
  ('Asheville', 0),
  ('Atlanta', 1),
  ('Birmingham', 2),
  ('Cape Girardeau', 3),
  ('Chattanooga', 4),
  ('Columbus', 5),
  ('Destin', 6),
  ('Huntsville', 7),
  ('Jackson, MS', 8),
  ('Jackson, TN', 9),
  ('Jacksonville', 10),
  ('Jonesboro', 11),
  ('Knoxville', 12),
  ('Lake Charles', 13),
  ('Little Rock', 14),
  ('Louisville', 15),
  ('Memphis', 16),
  ('Mobile', 17),
  ('Montgomery', 18),
  ('Nashville', 19),
  ('New Orleans', 20),
  ('Norfolk', 21),
  ('Raleigh', 22),
  ('Richmond', 23),
  ('San Antonio', 24),
  ('Savannah', 25),
  ('St. Louis', 26),
  ('Tallahassee', 27),
  ('Wilmington', 28)
on conflict (name) do nothing;
