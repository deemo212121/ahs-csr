-- Adds lightweight "last seen" presence tracking for customer accounts so
-- CSR staff can prioritize customers who are currently active in the portal.
-- Run this in the Supabase SQL editor (main app database).

alter table profiles add column if not exists last_seen_at timestamptz;

create index if not exists profiles_last_seen_at_idx on profiles(last_seen_at);
