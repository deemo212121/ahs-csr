# Customer My Requests Detail Modal Update

Updated the customer **My Requests** cards so **View Details** no longer routes directly to Messages.

## Changes

- The **View Details** action is now a button.
- Clicking **View Details** opens a dark themed request details modal.
- The modal shows the customer request information, including:
  - Request number
  - Current status
  - Verification status
  - ER ticket reference when available
  - Customer name, phone, and email
  - Service address
  - Appliance/product details
  - Preferred schedule
  - Issue description and special request
- Added a separate **Open Messages** button inside the modal.

## Behavior

Customer My Requests now works like this:

```text
Customer opens My Requests
↓
Clicks View Details
↓
Details popup opens
↓
Customer can review details first
↓
Customer can click Open Messages only when they want to chat
```

No database, ER sync, or message table logic was changed.
