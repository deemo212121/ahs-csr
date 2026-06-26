# Verification Queue detail update

This update improves the Verification tab while keeping the safe approval flow.

## What changed

- The Verification Queue table now shows more detailed columns, closer to the ER ticket table layout.
- Ticket number is clickable.
- Clicking a ticket number opens a full details popup/modal for the customer-submitted request.
- The popup shows customer information, address, appliance/product details, schedule details, issue description, warranty, sync status, and verification notes.
- The header back arrow button was removed.
- Staff notification red count is cleared when the user clicks the notification bell.

## Safe ER behavior remains unchanged

The Verification tab still uses the local website database. Pending requests are not inserted into the ER ticket table.

Flow:

```text
Customer submits request
↓
Saved in YOUR database as pending
↓
Shows in Verification tab
↓
Approve
↓
Local request becomes approved
↓
Approved ticket is inserted into ER public.tickets using safe fields only
```

The approval insert still avoids ER workflow/status fields unless they are explicitly configured.
