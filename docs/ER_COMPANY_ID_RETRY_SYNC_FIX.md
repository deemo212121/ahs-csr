# ER Company ID + Retry Sync Fix

This update fixes approved verification tickets failing to post to the ER `public.tickets` table with:

`null value in column "company_id" of relation "tickets" violates not-null constraint`

## What changed

- ER insert now forces `company_id` from `ER_DEFAULT_COMPANY_ID`.
- If the env value is missing/not read, the server safely falls back to the most common existing `company_id` in ER `tickets`.
- This fallback only reads ER tickets; it does not update/delete any ER data.
- Verification Queue now shows approved tickets that failed ER posting.
- Added Retry buttons for failed approved tickets so you do not need to re-approve them.

## Required env

Keep this in `.env.local`:

```env
TICKET_DATABASE_MODE=local
ER_SUPABASE_URL=https://vrgeuuiygskqtrotemir.supabase.co
ER_SUPABASE_SERVICE_ROLE_KEY=your_er_service_role_key
ER_SUPABASE_TICKETS_TABLE=tickets
ER_DEFAULT_COMPANY_ID=b86acc43-08df-4ef3-aae0-1653cb5a1fcd
ER_DEFAULT_CUSTOMER_ID=
ER_DEFAULT_TICKET_SOURCE=Customer Portal
ER_DEFAULT_WARRANTY=IW
ER_DEFAULT_STATUS=
```

Restart after env changes:

```bash
Ctrl + C
npm run dev
```

## Existing failed approvals

Open Verification Queue. If an approved ticket failed posting, a retry section appears. Click Retry for the ticket.
