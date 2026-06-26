# ER ticket company_id posting final fix

This update fixes the approved-ticket ER posting path.

## What changed

When a portal request is approved, the insert into ER `public.tickets` now forces `company_id` from these sources, in order:

1. `portal_service_requests.company_id`
2. `.env.local` `ER_DEFAULT_COMPANY_ID`
3. active company from ER `public.companies`
4. most common `company_id` already used in ER `public.tickets`

The insert payload is also checked before posting. If `company_id` is still empty, the retry fails before touching `public.tickets` and writes a clearer error.

## Safe scope

No ER schema changes are included in this patch. It does not alter, update, delete, or drop ER `public.tickets`, `public.customers`, or `public.companies`.

## After replacing files

Restart the dev server and clear the Next cache if needed:

```bash
Ctrl + C
rmdir /s /q .next
npm run dev
```

Then click the retry button for the failed approved request.

## Required env

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
