-- Adds a dedicated branch/region column to ticket_message_threads so the
-- Messages page can show the actual AHS branch (Atlanta, Decatur, etc.)
-- instead of accidentally reusing the street address field.
-- Run this in your MAIN app Supabase (not the ER Supabase) SQL editor.

alter table public.ticket_message_threads
  add column if not exists service_region text;
