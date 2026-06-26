-- Optional cleanup for ER portal_service_requests.
-- Run this only if you want the portal request table to have no sync columns.
-- The TypeScript code in this ZIP no longer reads/writes these columns.

alter table public.portal_service_requests
  drop column if exists sync_status,
  drop column if exists sync_error,
  drop column if exists last_synced_at,
  drop column if exists er_ticket_id,
  drop column if exists er_ticket_no;

drop index if exists public.portal_service_requests_sync_idx;
drop index if exists public.portal_service_requests_er_ticket_idx;
