# Admin ER Dashboard and Cities Update

This update changes the Admin Dashboard and Cities page to use live ER records where safe.

## What changed

- Admin Dashboard now loads live tickets using `GET /api/service-requests?view=tickets`.
- Those staff ticket records come from the ER Supabase `public.tickets` table.
- Admin dashboard metrics, top locations, brands, appliances, and recent activity now use the ER ticket rows.
- Admin Cities now reads ER `location_mgmt_coverage` instead of the old local `service_areas` table when ER Supabase is configured.
- Admin Cities is view-only when using ER coverage, so the portal does not edit their location records.

## Required `.env.local` values

```env
TICKET_DATABASE_MODE=local

ER_SUPABASE_URL=https://vrgeuuiygskqtrotemir.supabase.co
ER_SUPABASE_SERVICE_ROLE_KEY=their_er_service_role_key
ER_SUPABASE_TICKETS_TABLE=tickets
ER_SUPABASE_CUSTOMERS_TABLE=customers
ER_TICKET_VIEW_ORDER_COLUMN=created_at
ER_TICKET_VIEW_COMPANY_ID=

ER_LOCATION_COVERAGE_TABLE=location_mgmt_coverage
ER_LOCATION_VIEW_COMPANY_ID=

ER_DEFAULT_COMPANY_ID=b86acc43-08df-4ef3-aae0-1653cb5a1fcd
ER_DEFAULT_CUSTOMER_ID=
ER_DEFAULT_TICKET_SOURCE=Customer Portal
ER_DEFAULT_WARRANTY=IW
ER_DEFAULT_STATUS=
```

## Safety notes

- This update does not create ER SQL tables.
- This update does not add columns to ER tables.
- This update does not edit ER location records.
- Approved verification tickets are still inserted into ER `public.tickets` using the safe fields only.
- Pending verification requests still stay in your website database first.

## If more detailed admin metrics are needed later

To make Team Summary, call metrics, warnings, and mistakes fully live from ER, the portal would need read-only access to whichever ER tables store:

- staff / users / technicians
- teams or assignments
- call history / call logs
- warning or mistake records
- ticket audit log / status history

For now, the dashboard's request/ticket data, top locations, brands, appliances, recent ticket activity, and Cities coverage are ER-based.
