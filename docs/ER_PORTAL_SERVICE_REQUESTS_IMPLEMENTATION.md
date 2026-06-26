# ER Portal Service Requests Implementation

This update changes the verification flow to use a separate table in the ER Supabase database.

## New flow

```text
Customer submits request on your website
↓
Request is saved in ER public.portal_service_requests
↓
Verification Queue reads pending requests from ER public.portal_service_requests
↓
CSR/TL/Manager approves
↓
Website inserts a NEW row into ER public.tickets
↓
Website approves portal_service_requests only; ER updates er_ticket_id/er_ticket_no after posting
↓
Ticket list still reads live ER public.tickets
```

## Safe ER SQL

Run this file in the ER Supabase SQL Editor:

```text
supabase/er_portal_service_requests_setup.sql
```

It only creates:

```text
public.portal_service_requests
```

It does not alter, update, delete, or drop `public.tickets`.

## .env.local changes

Use ER portal mode:

```env
TICKET_DATABASE_MODE=er_supabase
ER_PORTAL_REQUESTS_TABLE=portal_service_requests
ER_SUPABASE_TICKETS_TABLE=tickets
ER_DEFAULT_COMPANY_ID=b86acc43-08df-4ef3-aae0-1653cb5a1fcd
ER_DEFAULT_CUSTOMER_ID=
ER_DEFAULT_TICKET_SOURCE=Customer Portal
ER_DEFAULT_WARRANTY=IW
ER_DEFAULT_STATUS=
```

Keep customer login/accounts and messages in your own Supabase. ER is used for portal service request verification and official ticket viewing/posting.

## ER ticket insert behavior

When approved, the app inserts only the safe fields into ER `public.tickets`:

```text
company_id
ticket_no
customer_id = null unless ER_DEFAULT_CUSTOMER_ID is set
location_id = null
assigned_tech_id = null
ticket_source
warranty
manufacturer
account = null
claim_company = null
model
model_version
serial
product_type
purchase_date
```

It does not send or change ER status/workflow fields.

## Messages

When an ER portal request is approved, the app creates a local message thread in your own Supabase. No ER message tables are added.
