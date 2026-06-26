# ER live ticket table style update

This version changes the staff ticket/request list to look closer to the ER Ticket List screen.

## What changed

- CSR Ticket page, Team Leader Requests page, Manager Tickets page, and Admin Requests page now display a wide ER-style ticket table.
- The table reads from the live ER `public.tickets` table through the existing server-side ER Supabase connection.
- The table is view-only in this portal.
- Columns shown include ticket number, warranty, source, customer reference, city, location, product, model, internal note, repair flag, technician, customer preference, schedule, status, phone, redo, aging, status spend, calls, part order, and posting date.

## Important limitation

The ER `tickets` export provided to ChatGPT did not contain direct columns for customer name, customer phone, or customer city. It only contained `customer_id`. Because of that, the portal can only show customer ID/fallback values unless the ER team allows a join to their customer/service account table later.

## Verification approval behavior

The verification tab remains safe:

- Customer submissions stay in this website's database first.
- Pending/rejected submissions do not go to ER.
- When approved, the portal inserts a new row into ER `public.tickets`.
- The approved insert only fills existing ER ticket fields up to `purchase_date`, plus required `company_id`.
- It does not send or change ER workflow/status fields.

## Required env setup

Keep:

```env
TICKET_DATABASE_MODE=local
ER_SUPABASE_URL=https://your-er-project.supabase.co
ER_SUPABASE_SERVICE_ROLE_KEY=your-er-service-role-key
ER_SUPABASE_TICKETS_TABLE=tickets
ER_SUPABASE_CUSTOMERS_TABLE=customers
ER_TICKET_VIEW_ORDER_COLUMN=created_at
ER_TICKET_VIEW_COMPANY_ID=
ER_DEFAULT_COMPANY_ID=your-er-company-id
ER_DEFAULT_CUSTOMER_ID=
ER_DEFAULT_TICKET_SOURCE=Customer Portal
ER_DEFAULT_WARRANTY=IW
ER_DEFAULT_STATUS=
```

Leave `ER_DEFAULT_STATUS` blank to avoid forcing/changing ER status.
