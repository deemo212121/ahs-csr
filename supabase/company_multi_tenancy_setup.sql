-- Multi-tenant company_id rollout for this app's own Postgres tables.
-- Purely additive: adds nullable columns, backfills existing rows to the
-- one company everyone already belongs to today, then locks the column so
-- every future row must carry a company_id. Nothing is dropped or deleted.
--
-- The backfill value below is this app's existing ER_DEFAULT_COMPANY_ID
-- (already in .env.local) — i.e. "AH Solutions", the only company this app
-- has ever operated as. Existing customers/tickets/calls end up exactly
-- where they already are today: visible to the same staff who see them now.
--
-- Run this once in the Supabase SQL editor for the MAIN app database
-- (the same one schema.sql / rtc_calls_setup.sql / customer_ticket_messages_setup.sql
-- were run against). Do NOT run this against the ER database — its
-- `profiles`/`tickets`/`portal_service_requests` tables already have
-- company_id and are owned by the ER team.

do $$
declare
  default_company_id uuid := 'b86acc43-08df-4ef3-aae0-1653cb5a1fcd';
begin
  -- profiles (customers + any local-only rows)
  alter table if exists profiles add column if not exists company_id uuid;
  update profiles set company_id = default_company_id where company_id is null;
  alter table if exists profiles alter column company_id set not null;
  create index if not exists profiles_company_idx on profiles(company_id);

  -- service_requests (local fallback ticket path, used only when
  -- TICKET_DATABASE_MODE is unset/not er_supabase)
  alter table if exists service_requests add column if not exists company_id uuid;
  update service_requests set company_id = default_company_id where company_id is null;
  alter table if exists service_requests alter column company_id set not null;
  create index if not exists service_requests_company_idx on service_requests(company_id);

  -- rtc_calls (live web-call queue)
  alter table if exists rtc_calls add column if not exists company_id uuid;
  update rtc_calls set company_id = default_company_id where company_id is null;
  alter table if exists rtc_calls alter column company_id set not null;
  create index if not exists rtc_calls_company_idx on rtc_calls(company_id);

  -- call_requests (legacy call queue, still present alongside rtc_calls)
  alter table if exists call_requests add column if not exists company_id uuid;
  update call_requests set company_id = default_company_id where company_id is null;
  alter table if exists call_requests alter column company_id set not null;
  create index if not exists call_requests_company_idx on call_requests(company_id);

  -- ticket_message_threads / ticket_messages: added nullable only for now.
  -- Several thread-creation code paths (ensureErTicketThreads,
  -- backfillErPortalRequestThreads) are not yet wired to populate this
  -- column, so it is deliberately NOT enforced (no backfill, no NOT NULL)
  -- until that follow-up lands — enforcing it here would be able to hide
  -- existing conversations from staff.
  alter table if exists ticket_message_threads add column if not exists company_id uuid;
  create index if not exists ticket_message_threads_company_idx on ticket_message_threads(company_id);

  alter table if exists ticket_messages add column if not exists company_id uuid;
end $$;
