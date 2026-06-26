# Local Verification → ER Existing Tickets Table

This is the current safe setup.

Do **not** run any SQL in the ER Supabase project for this flow. It does not add a table and it does not add columns to their `public.tickets` table.

## Flow

```text
Customer submits request on your website
↓
Saved in YOUR Supabase `service_requests` table only
↓
Shows in YOUR Verification tab as `verification_status = pending`
↓
CSR / Team Leader / Manager approves
↓
Your website updates the local request to `verification_status = approved`
↓
Your website inserts one new row into THEIR existing `public.tickets` table
↓
The approved ticket appears in your website Ticket Request page as view-only
↓
Their ER system can action/edit/dispatch the ticket from their own tickets table
```

## Required `.env.local` values

Keep the ticket database mode local:

```env
TICKET_DATABASE_MODE=local
```

Add the ER Supabase connection server-side only. Leave `ER_SYNC_API_URL` blank if you want to use direct Supabase sync:

```env
ER_SYNC_API_URL=
ER_SYNC_API_KEY=
ER_SUPABASE_URL=https://their-project.supabase.co
ER_SUPABASE_SERVICE_ROLE_KEY=their-service-role-key
ER_SUPABASE_TICKETS_TABLE=tickets

ER_DEFAULT_COMPANY_ID=b86acc43-08df-4ef3-aae0-1653cb5a1fcd
ER_DEFAULT_CUSTOMER_ID=
ER_DEFAULT_TICKET_SOURCE=Customer Portal
ER_DEFAULT_WARRANTY=IW
```

Do not set `ER_DEFAULT_STATUS` for the current safe flow. The direct ER insert will not send a status value.

`ER_DEFAULT_COMPANY_ID` is required because their `tickets.company_id` is required.

`ER_DEFAULT_CUSTOMER_ID` can stay blank because you verified that their `tickets.customer_id` is nullable.

## What gets inserted into their `public.tickets` table

The approval sync uses only existing columns in their tickets table:

```text
company_id
customer_id = null unless ER_DEFAULT_CUSTOMER_ID is provided
location_id = null
assigned_tech_id = null
ticket_no = your local request number
ticket_source = Customer Portal
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

The safe direct ER insert does not send `status`, `schedule_date`, `problem_description`, `internal_note`, or other workflow/action fields. It only creates a new ER ticket row using the existing ticket columns from ticket number through purchase date, plus `company_id` because it is required.

## Important

Do not set this for the current flow:

```env
TICKET_DATABASE_MODE=er_supabase
```

That old mode was for an ER-side verification table, and it requires adding tables/columns in their database. Since they told you not to add anything to their `tickets` table, keep the mode as `local`.

## Safe checks you already completed

You confirmed:

```text
tickets.customer_id is nullable = YES
only company_id and ticket_no are required
```

So the website can post approved tickets to their ER `tickets` table without a default customer ID.
