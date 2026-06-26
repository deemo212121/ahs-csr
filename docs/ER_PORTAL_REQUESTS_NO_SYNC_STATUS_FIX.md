# portal_service_requests sync_status note

The ER `public.portal_service_requests` table does not need `sync_status` or `sync_error` columns.

Current build determines sync state from existing columns:

- `er_ticket_id` / `er_ticket_no` present = already posted to ER tickets
- approved + no `er_ticket_id` = needs posting
- pending = waiting for review

No schema change is required.
