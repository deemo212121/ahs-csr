# ER Portal RPC Approval Update

This build changes approved portal request posting to use an ER database RPC/function.

## Flow

Customer request → ER `portal_service_requests` → Verification approval → call `approve_portal_request_to_ticket(request_id)` → ER function inserts into `public.tickets` → request is marked `synced_to_er`.

## SQL to run in ER Supabase

Run:

```text
supabase/er_approve_portal_request_to_ticket_rpc.sql
```

This creates/replaces only:

```text
public.approve_portal_request_to_ticket(uuid)
```

It does not alter/drop/update/delete the existing `public.tickets` table. The function inserts a new ticket only when called by the website after approval or retry.

## Optional env

```env
ER_APPROVE_PORTAL_REQUEST_RPC=approve_portal_request_to_ticket
```

If omitted, the app uses `approve_portal_request_to_ticket` by default.
