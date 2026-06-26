# ER Audit Log User Profile Name Update

## What changed

- The ER `profiles` export was checked and it contains the ER user records.
- `ticket_audit_log.changed_by` matches `profiles.id`, so Activity Logs can now show the ER user's display name, email, and role.
- Admin Activity Logs and CSR Manager Activity Logs use this same shared ER audit log mapping.
- If a user cannot be matched, the page still falls back to `ER User xxxx` so the logs do not break.

## Environment variable

Add this to `.env.local`:

```env
ER_PROFILES_TABLE=profiles
```

Keep the existing ER audit settings:

```env
ER_TICKET_AUDIT_LOG_TABLE=ticket_audit_log
ER_SUPABASE_TICKETS_TABLE=tickets
ER_SUPABASE_CUSTOMERS_TABLE=customers
```

## Safety note

This is read-only. It only reads `profiles` to display the actor name/email in Activity Logs.
