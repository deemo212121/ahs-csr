# Previous Approval-only Flow

This note is kept only for history. The current build no longer uses approval-only posting.

Current build: approved `portal_service_requests` are posted directly into ER `public.tickets` by the website, then the portal row is updated with `er_ticket_id` and `er_ticket_no`.
