# Admin Staff Management - ER Profiles View-Only Update

## What changed

The Admin Staff Management page now reads staff from the ER database `public.profiles` table through the existing ER Supabase connection.

This is intentionally **view-only** because these are live ER accounts. No reset password, account activation, deactivation, delete, or edit action was added.

## API update

Added:

```txt
GET /api/admin/catalogs?type=staff
```

The endpoint uses:

```txt
ER_PROFILES_TABLE=profiles
ER_TICKET_VIEW_COMPANY_ID=<optional company filter>
```

If the ER Supabase connection is not configured or the ER query fails, it falls back to local profiles so the page does not completely break during development.

## Staff page improvements

The page now includes:

- Total staff, active accounts, admins, team leaders, CSR agents, and branch coverage stats.
- Search by name, email, username, branch, manager, employee ID, technician ID, and PO initials.
- Filters for role, active/inactive status, branch, and manager.
- Read-only staff directory table.
- Leadership snapshot for Admins, Managers, Team Leaders, and Branch Managers.
- Role breakdown panel.
- Branch access overview.
- Clickable staff rows with a profile detail modal.
- Modal shows account info, manager, branch, check-in/out, last login, created date, branch access, and work plan branches.

## Why this approach

Since ER is the live account source, Admin Hub should not reset or modify passwords from this page yet. Viewing and filtering is safe. Later, if approved, write actions can be added through controlled ER-side admin functions instead of directly editing live auth/account records.
