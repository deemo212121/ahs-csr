# What changed in this build

This build removes the need to add verification tables or columns in the ER Supabase project.

## Implemented

- Customer-submitted requests stay in your website database first.
- Verification Queue reads pending customer requests from your website database.
- Approving a request updates it locally to `verification_status = approved`.
- The approved request then inserts into their existing ER `public.tickets` table.
- `customer_id` is sent as `null` when `ER_DEFAULT_CUSTOMER_ID` is blank.
- The CSR/Manager Ticket Request pages only show approved customer tickets and manual CSR tickets.
- Pending/rejected customer tickets stay out of the Ticket Request table.
- Removed the old ER SQL setup files from this package to avoid accidentally changing their schema.

## Required env setup

```env
TICKET_DATABASE_MODE=local

ER_SYNC_API_URL=
ER_SYNC_API_KEY=
ER_SUPABASE_URL=
ER_SUPABASE_SERVICE_ROLE_KEY=
ER_SUPABASE_TICKETS_TABLE=tickets

ER_DEFAULT_COMPANY_ID=
ER_DEFAULT_CUSTOMER_ID=
ER_DEFAULT_TICKET_SOURCE=Customer Portal
ER_DEFAULT_WARRANTY=IW
```

`ER_DEFAULT_CUSTOMER_ID` can stay blank because their `tickets.customer_id` allows NULL. Do not set `ER_DEFAULT_STATUS` for this safe flow; the ER insert will not send a status value.
