# Ticket List and Admin Notifications Update

This update keeps the existing ER/database sync behavior unchanged.

## Ticket list

- Removed the left checkmark column from the shared ER ticket table.
- `Ticket No` is now the first column.
- This shared table is used by CSR, Team Leader, CSR Manager, and Admin ticket/request views.
- Ticket numbers remain clickable and still open the full ticket detail modal.

## Admin notifications

- The Admin notification bell now opens a dropdown panel.
- The red notification number is cleared when the Admin clicks the bell.
- The read state is stored in local storage per Admin user.
- The dropdown includes admin-wide notification shortcuts for tickets, verification, activity logs, discipline records, and city coverage.

No ER insert, ticket approval, or database schema logic was changed.
