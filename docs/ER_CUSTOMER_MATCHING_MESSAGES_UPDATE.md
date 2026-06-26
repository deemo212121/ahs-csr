# ER Customer Matching + Local Messages Update

This update keeps customer accounts and chat/messages in the website Supabase database while reading ER ticket/customer records from the ER Supabase database.

## Flow

1. Customer creates an account in the website database.
2. Website compares the customer phone/email with ER `customers` records.
3. Matching ER customer IDs are saved locally in `customer_er_links`.
4. One website customer can link to multiple ER customer IDs because ER may have duplicate customers from manual/Discord ticketing.
5. Customer portal can show ER tickets where `tickets.customer_id` matches any linked ER customer ID.
6. Ticket conversations are stored only in website Supabase using `ticket_message_threads` and `ticket_messages`.

## Matching rules

Automatic matching uses:

- phone match from website profile to ER `phone` or `second_phone`
- email match when ER customer has email

Name is used only to improve confidence. Name-only matching is not used automatically because different customers may share the same name.

## Important

Run this SQL in the website Supabase only:

```text
supabase/customer_ticket_messages_setup.sql
```

Do not run it in ER Supabase. This update does not add or change ER tables.

## Current behavior

- Existing ER/manual tickets can create local message threads if the ER customer matches the website customer by phone/email.
- Website-created tickets still pass through verification first.
- Approved website-created tickets can still show in the customer portal through local ownership even if the ER row has `customer_id = null`.
