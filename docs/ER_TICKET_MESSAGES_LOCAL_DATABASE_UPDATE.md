# ER Ticket Messages Using Local Database

This update lets the website create message conversations for live ER tickets while keeping all chat records in the website Supabase database.

## Flow

- ER Supabase remains the ticket source of truth.
- Website Supabase remains the message/chat source of truth.
- Staff message pages read ER tickets, match their ER customer details, then create local message threads.
- No ER message tables are created.
- No ER ticket or customer rows are edited.

## Customer matching

The system reads the ER ticket `customer_id`, loads that customer from the ER `customers` table, then tries to match it to a website customer profile by email or phone number.

- If matched: the customer can see and reply to the conversation in the customer portal.
- If not matched: the conversation still appears for CSR, TL, Manager, and Admin as staff-side only until a customer account is matched later.

## Required SQL

Run `supabase/customer_ticket_messages_setup.sql` again in the website Supabase only.

Do not run this SQL in ER Supabase.

## Required environment variables

```env
ER_SUPABASE_URL=...
ER_SUPABASE_SERVICE_ROLE_KEY=...
ER_SUPABASE_TICKETS_TABLE=tickets
ER_SUPABASE_CUSTOMERS_TABLE=customers
ER_TICKET_VIEW_ORDER_COLUMN=created_at
```

## Pages affected

- `/customer/messages`
- `/csr/messages`
- `/team-leader/messages`
- `/manager/messages`

