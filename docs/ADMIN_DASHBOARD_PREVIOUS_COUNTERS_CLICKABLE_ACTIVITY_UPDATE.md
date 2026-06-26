# Admin Dashboard Previous Counters + Clickable Recent Activity Update

## Files changed
- `src/components/admin/AdminDashboard.tsx`
- `src/styles/globals.css`

## What changed
- Restored the Overall Ticket Total and Today counter cards to the previous compact centered design.
- Kept better spacing between the counter label and highlighted number.
- Made Dashboard Recent Activity rows clickable.
- Clicking a Recent Activity row now opens a pop-up detail view instead of redirecting away.
- ER audit activity pop-up shows:
  - date/time
  - actor/source
  - ticket/request number
  - customer/ticket info
  - summary
  - changed field
  - before value
  - after value
  - notes, if available
- Ticket-row fallback pop-up shows current ticket details and last update info.

## ER audit log usage
The dashboard still reads ER `ticket_audit_log` through the existing `/api/admin/catalogs?type=activity-logs` API. This is better than duplicating audit rows into Admin Hub because the ER audit log is the source of truth for ticket changes.
