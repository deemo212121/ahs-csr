-- Adds per-side read tracking to ticket_message_threads so the Messages
-- pages can show unread/read state and a count badge for both the customer
-- and staff side of each shared conversation.
-- Run this in your MAIN app Supabase (not the ER Supabase) SQL editor.

alter table public.ticket_message_threads
  add column if not exists customer_last_read_at timestamptz,
  add column if not exists staff_last_read_at timestamptz;
