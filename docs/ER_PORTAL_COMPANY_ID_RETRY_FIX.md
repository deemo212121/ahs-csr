# ER Portal Company ID Retry Fix

This update fixes approved portal requests failing to post into ER `public.tickets` with:

`null value in column "company_id" of relation "tickets" violates not-null constraint`

## What changed

- ER ticket posting now re-checks `portal_service_requests.company_id`.
- If that row is missing `company_id`, the app falls back to `ER_DEFAULT_COMPANY_ID`.
- If `.env.local` is not available, the app tries to read the most common `company_id` already used in ER `tickets`.
- Old approved requests with missing `company_id` can be retried from the Verification Queue.

## Optional repair SQL

If old ER `portal_service_requests` rows were created with `company_id` missing, run:

`supabase/er_portal_service_requests_repair_company_id.sql`

This SQL only touches `public.portal_service_requests`. It does not alter, update, or delete ER `public.tickets` or `public.customers`.

## Required .env.local

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

Restart `npm run dev` after changing `.env.local`.
