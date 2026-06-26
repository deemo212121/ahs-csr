# ER Audit Log + Manager Activity Logs + Discipline Table Update

## What changed

- Admin Activity Logs now try to read from the ER Supabase `ticket_audit_log` table first.
- ER audit `changed_by` values are matched to `profiles.id`, so the activity rows can show the ER user display name, role, and email instead of `ER User xxxx`.
- Each audit log is matched to the ER `tickets` table using `ticket_id` so the activity row can show the ticket number, customer/ticket context, product, location, and status when available.
- If the ER customer table is configured, customer name/phone is also matched through `tickets.customer_id`.
- If ER audit logs are unavailable or ER Supabase is not configured, the page falls back to the local `request_logs` table.
- CSR Manager now has an Activity Logs page at `/manager/activity-logs`.
- CSR Manager drawer and dashboard quick actions now include Activity Logs.
- Sent Mistakes and Sent Warnings tables were tightened so the table stays inside the border/panel.

## Environment variable

Add this to `.env.local` if not already present:

```env
ER_TICKET_AUDIT_LOG_TABLE=ticket_audit_log
ER_PROFILES_TABLE=profiles
```

The existing ER settings are still used:

```env
ER_SUPABASE_URL=
ER_SUPABASE_SERVICE_ROLE_KEY=
ER_SUPABASE_TICKETS_TABLE=tickets
ER_SUPABASE_CUSTOMERS_TABLE=customers
ER_TICKET_VIEW_COMPANY_ID=
ER_PROFILES_TABLE=profiles
```

`ER_TICKET_VIEW_COMPANY_ID` can stay blank to show all ER audit logs. Fill it only if the ER team wants the portal limited to one company.

## Safety note

The Activity Logs integration is read-only. It does not update, delete, or insert any ER audit log records.
