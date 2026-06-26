# CSR Agent Handled Tickets + Footer Update

## What changed

- Reworked the CSR bottom navigation/footer so it stays in one clean row on desktop and becomes a horizontal compact nav on smaller screens.
- CSR Dashboard now focuses on tickets handled by the logged-in CSR, not all tickets.
- Added dashboard ticket-number blocks:
  - Overall Handled
  - Handled Today
- Recent ticket activity now only shows handled tickets for that CSR.
- CSR Tickets page now defaults to **My Handled Tickets**.
- Added a switch to view **All ER Tickets** when the agent still needs full visibility.

## Source of truth for handled tickets

Handled tickets are based on ER data:

1. Primary source: `ticket_audit_log.changed_by = current ER profiles.id`
2. Fallback source: `tickets.status_changed_by = current ER profiles.id`

This is better than filtering by branch only because it tracks the actual CSR user who changed a ticket status, schedule, or other audited ticket field.

## Files updated

- `src/components/csr/CsrDashboard.tsx`
- `src/components/csr/CsrTicketsPage.tsx`
- `src/lib/er-ticket-database.ts`
- `src/lib/types.ts`
- `src/styles/globals.css`

## Notes

The ER profiles table must have the current Firebase staff account linked through `firebase_uid`, because the logged-in profile id is used to match `ticket_audit_log.changed_by` and `tickets.status_changed_by`.
