# Approve Direct to ER Tickets Update

This build changes the ER portal request flow back to direct posting after approval.

## Flow

Customer submits request  
→ saved in ER `public.portal_service_requests` as `pending`  
→ CSR/TL/Manager approves in the website  
→ website inserts one new row into ER `public.tickets`  
→ website updates the same `portal_service_requests` row with `er_ticket_id`, `er_ticket_no`, and `last_synced_at`  
→ Ticket List shows the ticket because it reads live ER `public.tickets`.

## Database structure changes

No database schema change is required.

This build does **not** add columns, drop tables, alter tables, or create functions.

It only inserts a new row into `public.tickets` when a request is approved.

## Tickets insert columns

The insert uses only existing ER `public.tickets` columns:

- `company_id`
- `ticket_no`
- `customer_id` = `ER_DEFAULT_CUSTOMER_ID` if set, otherwise `null`
- `location_id` = `null`
- `assigned_tech_id` = `null`
- `ticket_source`
- `warranty`
- `manufacturer`
- `account` = `null`
- `claim_company` = `null`
- `model`
- `model_version`
- `serial`
- `product_type`
- `purchase_date`

It does not set ER workflow fields like status, schedule, tech, stage, or internal workflow.

## Existing approved requests

If older approved requests already exist in `portal_service_requests` but have no `er_ticket_id`, the Verification Queue will show a posting panel. Click **Post SRV-...** to create the ER ticket row.

The code checks for an existing `tickets.ticket_no` first so it will link instead of creating a duplicate ticket number.
