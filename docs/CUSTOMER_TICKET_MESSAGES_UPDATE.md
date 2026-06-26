# Customer Ticket Messages Update

This update adds a ticket-based messaging system using the portal Supabase database only.

## Flow

1. Customer creates a service request.
2. Request stays in the portal database and appears in Verification.
3. Once approved, the system creates a local message thread for that ticket.
4. Customer sees an automatic approval message.
5. Customer can reply about the ticket.
6. CSR, Team Leader, and CSR Manager can see and respond to ticket conversations.
7. Previous approved portal tickets are backfilled into message threads when the Messages page opens.

## Important

The ER database is not changed. No message table is added to ER.

## SQL required

Run this file in the portal Supabase database:

```text
supabase/customer_ticket_messages_setup.sql
```

Do not run it in the ER Supabase database.

## Pages updated

- Customer Messages
- CSR Messages
- Team Leader Messages
- CSR Manager Messages

## Behavior

Approved tickets automatically create an opening system message:

> Your service request has been approved. You can reply here for schedule updates, address changes, appliance details, or questions about this ticket.

Customers also have quick message suggestions for first-time replies.
