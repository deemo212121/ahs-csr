# CSR Agent Request and Manual Update

This pass focuses on the CSR Agent portal based on the PHP screenshots.

## Updated pages

- `/csr/request`
- `/csr/requests`
- `/csr/tickets`
- `/csr/manual`

## Changes

- CSR Request/Tickets now uses the PHP-style ticket layout:
  - page title with Create Manual Ticket, Web Call Queue, and Refresh buttons
  - Filter Requests panel
  - Ticket Table (View Only)
  - source pill, customer, phone, appliance, status, ticket age, last updated, and action buttons
- Added `/csr/requests` as an alias route because the old PHP path used `requests.php`.
- CSR Manual now uses the same centered PHP-style Manual Ticket Entry layout used by TL/Manager.
- Manual form no longer uses the customer form look with white inputs.
- Appliance column now prioritizes appliance/category name instead of showing model number.

## Notes

This is a layout/UI migration pass. Deeper behavior such as exact CSR locking, chat opening, call room joining, and full manual-ticket CRM actions still need to be wired in later.
