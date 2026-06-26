# Live ER Ticket View Update

This update keeps verification in **your website database**, but changes the staff Ticket Request pages to read from the live ER `public.tickets` table.

## Current safe flow

```text
Customer submits request on your website
↓
Saved in your Supabase service_requests table as pending verification
↓
Shows in your Verification tab
↓
CSR/TL/Manager approves
↓
Your website marks the local request approved
↓
Your website inserts a NEW row into their ER public.tickets table
↓
Your staff Ticket Request pages read/view the live ER public.tickets table
```

## What was changed

- `/api/service-requests?view=tickets` now returns live ER tickets when `ER_SUPABASE_URL` and `ER_SUPABASE_SERVICE_ROLE_KEY` are configured. It shows all ER ticket rows by default.
- It does not require new ER SQL.
- It does not add columns/tables to ER.
- It does not update existing ER tickets.
- ER ticket viewing uses only the existing ER `tickets` columns from the provided export.

## Required `.env.local`

```env
TICKET_DATABASE_MODE=local

ER_SUPABASE_URL=https://their-project.supabase.co
ER_SUPABASE_SERVICE_ROLE_KEY=their-service-role-key
ER_SUPABASE_TICKETS_TABLE=tickets
ER_SUPABASE_CUSTOMERS_TABLE=customers
ER_TICKET_VIEW_ORDER_COLUMN=created_at
ER_TICKET_VIEW_COMPANY_ID=

ER_DEFAULT_COMPANY_ID=b86acc43-08df-4ef3-aae0-1653cb5a1fcd
ER_DEFAULT_CUSTOMER_ID=
ER_DEFAULT_TICKET_SOURCE=Customer Portal
ER_DEFAULT_WARRANTY=IW
```

`ER_DEFAULT_CUSTOMER_ID` can stay blank because their `tickets.customer_id` is nullable.

## Important limitation

The ER `tickets` table export does not include customer name, phone, or email columns. Because of that, the staff ticket table can show ER ticket fields such as ticket number, source, appliance/product, brand, model, status, and location, but customer name/phone will only show if the ER table provides those fields or if the ER team later allows a customer/account join/API.

