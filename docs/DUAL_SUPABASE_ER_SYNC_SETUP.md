# Dual Supabase / ER Sync Setup

This update lets the customer portal keep its own Supabase database while also sending approved verification tickets to the other TypeScript/ER Supabase database.

## What changed

When CSR, Team Leader, CSR Manager, or Admin approves a ticket in the Verification Queue:

1. The ticket is approved in this portal database.
2. The portal tries to send the ticket to the ER system.
3. The portal keeps a view-only copy and stores the ER ticket/table row ID in `er_ticket_id`.
4. If ER credentials are not configured yet, the ticket remains approved locally with `sync_status = pending_er_sync`.
5. If ER sync fails, the ticket remains approved locally with `sync_status = sync_failed` and the reason is saved in `sync_error`.

## Recommended option: ER API

Ask the other TypeScript developer to create an API endpoint that accepts approved tickets.

Add this to `.env.local`:

```env
ER_SYNC_API_URL=https://their-er-domain.com/api/tickets/from-customer-portal
ER_SYNC_API_KEY=your-shared-secret-key
```

The portal will send:

```json
{
  "event": "ticket_verified",
  "ticket": {
    "portal_request_id": "...",
    "portal_request_number": "...",
    "customer_name": "...",
    "phone_number": "...",
    "service_address": "...",
    "issue_description": "...",
    "sync_payload": {}
  }
}
```

## Alternative option: direct ER Supabase connection

Only use this server-side. Never put the ER service role key in frontend/client code.

1. Open the other ER project's Supabase SQL editor.
2. Run `supabase/er_portal_verified_tickets_table.sql` from this project.
3. Add this to this portal's `.env.local`:

```env
ER_SUPABASE_URL=https://your-er-project.supabase.co
ER_SUPABASE_SERVICE_ROLE_KEY=your-er-service-role-key
ER_SUPABASE_TICKETS_TABLE=portal_verified_tickets
```

The default table is `portal_verified_tickets`. The ER TypeScript project can read that table and process/action the ticket from there.

## Local portal Supabase required columns

Your local `service_requests` table already supports these fields in `supabase/schema.sql`:

- `er_ticket_id`
- `sync_status`
- `sync_error`
- `last_synced_at`

If your Supabase table was created before these fields existed, run the latest `supabase/schema.sql` or add those columns manually.

## Re-sync an already approved ticket

If a ticket was approved before ER credentials were added, it will show as `pending_er_sync`.
After adding the ER credentials, you can retry sync through this server route:

```http
POST /api/service-requests/{request_id}/sync-er
```

This route is only allowed for CSR, Team Leader, CSR Manager, and Admin accounts.


## Ticket Request visibility rule

CSR, Team Leader, Manager, and Admin Ticket Request pages now call:

```http
GET /api/service-requests?view=tickets
```

That view only returns normal ticket-table records:

- approved customer-submitted tickets
- manual CSR tickets

Pending or rejected customer-submitted tickets stay out of the normal Ticket Request table. Pending customer tickets should only appear in the Verification Queue through:

```http
GET /api/service-requests?verification_status=pending
```

After approval, the review route updates the local request to `verification_status = approved`, then calls ER sync:

```http
POST /api/service-requests/{request_id}/review
```

If ER credentials/API are already configured, the approved ticket is sent to ER immediately. If not, it stays approved locally with `sync_status = pending_er_sync` until you add the ER connection and retry sync.

## What you need from the other TypeScript / ER project

Recommended setup: ask the ER developer for one server API endpoint, not direct database access.

You need these from them:

1. ER API URL, for example `https://their-er-domain.com/api/tickets/from-customer-portal`
2. Shared secret/API key, for example `ER_SYNC_API_KEY`
3. Confirmation of the fields they expect in the approved-ticket payload
4. The ER ticket ID field they will return, such as `er_ticket_id`, `ticket_id`, `request_id`, or `id`

Then add this to your `.env.local`:

```env
ER_SYNC_API_URL=https://their-er-domain.com/api/tickets/from-customer-portal
ER_SYNC_API_KEY=replace-with-the-secret-they-give-you
```

Alternative setup: if they do not want to create an API yet, they can give you the ER Supabase URL and server-side service role key. Only place that service role key in `.env.local` on your server. Never put it in client/browser code.

```env
ER_SUPABASE_URL=https://their-er-project.supabase.co
ER_SUPABASE_SERVICE_ROLE_KEY=replace-with-er-service-role-key
ER_SUPABASE_TICKETS_TABLE=portal_verified_tickets
```

For the direct Supabase option, run this SQL file in the ER project's Supabase SQL editor first:

```text
supabase/er_portal_verified_tickets_table.sql
```
