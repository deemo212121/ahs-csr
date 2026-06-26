# ER Supabase as the Main Ticket Database

This setup is for the flow where the other TypeScript/ER Supabase is the official ticket database.

## Final flow

```text
Customer submits request from your website
        ↓
Saved in ER Supabase: public.portal_ticket_requests
verification_status = pending
        ↓
Your website Verification tab reads public.portal_ticket_requests
        ↓
CSR/TL/Manager approves
        ↓
Your website creates the official ER ticket in public.tickets
        ↓
Their ER project actions/dispatches the ticket
        ↓
Your website reads public.tickets as view-only
```

Your own Supabase can still be used for portal-only records like users/profiles, chat, notifications, calls, and settings.

## Step 1 — Run the SQL in the ER Supabase

Open the ER Supabase dashboard, go to SQL Editor, and run:

```text
supabase/er_native_ticket_verification_setup.sql
```

This creates:

```text
public.portal_ticket_requests
```

It also adds portal display columns to their existing:

```text
public.tickets
```

## Step 2 — Add ER credentials to `.env.local`

Use this when your website should use the ER Supabase for customer request verification and official tickets:

```env
TICKET_DATABASE_MODE=er_supabase

ER_SUPABASE_URL=https://YOUR_ER_PROJECT.supabase.co
ER_SUPABASE_SERVICE_ROLE_KEY=THEIR_ER_SERVICE_ROLE_KEY
ER_PORTAL_REQUESTS_TABLE=portal_ticket_requests
ER_SUPABASE_TICKETS_TABLE=tickets

ER_DEFAULT_COMPANY_ID=ASK_ER_OWNER_FOR_COMPANY_UUID
ER_DEFAULT_CUSTOMER_ID=ASK_ER_OWNER_FOR_PORTAL_CUSTOMER_UUID
ER_DEFAULT_TICKET_SOURCE=Customer Portal
ER_DEFAULT_WARRANTY=IW
ER_DEFAULT_STATUS=Acknowledged
```

Keep your own Supabase settings too, because your website still uses your database for portal login/profile data:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_PORTAL_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PORTAL_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_PORTAL_SUPABASE_SERVICE_ROLE_KEY
```

## What to ask the ER developer / owner

Ask them for:

```text
1. ER Supabase Project URL
2. ER Supabase service role key
3. Default company_id UUID
4. Default customer_id UUID for Customer Portal tickets
5. Confirmation that the main table is public.tickets
6. Confirmation that new portal tickets should start as status = Acknowledged
```

## Why `ER_DEFAULT_CUSTOMER_ID` is needed

Their `public.tickets` table currently has a `customer_id` column. Your website's customer profile lives in your own Supabase, so it cannot automatically use their internal ER customer IDs yet.

The easiest setup is to create or choose one default ER customer record named something like:

```text
Customer Portal / Online Request
```

Then put that UUID in:

```env
ER_DEFAULT_CUSTOMER_ID=
```

The real customer details are still saved into the portal display columns on `public.tickets`:

```text
portal_customer_name
portal_customer_phone
portal_customer_email
portal_service_address
portal_city
portal_state
portal_zip_code
```

## What changed in the website

When `TICKET_DATABASE_MODE=er_supabase`:

- `/api/service-requests` creates pending customer requests in ER `portal_ticket_requests`.
- The Verification page reads pending requests from ER `portal_ticket_requests`.
- Approving a request inserts/upserts the official ticket in ER `tickets`.
- The CSR/TL/Manager/Admin Ticket Request pages read ER `tickets` as view-only.
- Your own portal database can still keep customers, chat, notifications, and calls.

When `TICKET_DATABASE_MODE=local`, the website keeps using the old local `service_requests` table and optional ER sync.
