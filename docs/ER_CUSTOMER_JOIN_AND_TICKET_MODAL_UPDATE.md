# ER Customer Join + Ticket Detail Popup Update

This update keeps the safe flow:

1. Customer requests stay in this website database while pending verification.
2. After approval, the approved request is inserted into the existing ER `public.tickets` table.
3. The staff ticket pages are view-only and read live data from the ER `public.tickets` table.

## What changed

- Staff ticket tables now also read from the ER `public.customers` table by matching `tickets.customer_id` to `customers.id`.
- The table now shows customer name, city, phone, email/address details when available.
- Ticket number is clickable. Clicking it opens a view-only popup with the full ticket details.
- The old action/view column was removed because the ticket number now opens the details popup.
- CSR, Team Leader, CSR Manager, and Admin ticket pages all use the shared ER ticket table component.
- CSR and Team Leader filter/search controls now actually filter the live ER ticket list.

## Environment variable

Add/keep this line. The default is `customers`, but it is better to be explicit:

```env
ER_SUPABASE_CUSTOMERS_TABLE=customers
```

Full ER-related setup:

```env
TICKET_DATABASE_MODE=local

ER_SUPABASE_URL=https://vrgeuuiygskqtrotemir.supabase.co
ER_SUPABASE_SERVICE_ROLE_KEY=their_er_service_role_key
ER_SUPABASE_TICKETS_TABLE=tickets
ER_SUPABASE_CUSTOMERS_TABLE=customers
ER_TICKET_VIEW_ORDER_COLUMN=created_at
ER_TICKET_VIEW_COMPANY_ID=

ER_DEFAULT_COMPANY_ID=b86acc43-08df-4ef3-aae0-1653cb5a1fcd
ER_DEFAULT_CUSTOMER_ID=
ER_DEFAULT_TICKET_SOURCE=Customer Portal
ER_DEFAULT_WARRANTY=IW
ER_DEFAULT_STATUS=
```

Do not run the old ER verification SQL. This version does not require adding tables or columns to the ER database.
