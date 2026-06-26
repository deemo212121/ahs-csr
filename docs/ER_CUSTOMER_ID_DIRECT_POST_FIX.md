# ER customer_id direct posting fix

This build keeps the direct approval flow:

Customer request -> ER `portal_service_requests` pending -> CSR/TL/Manager approve -> website posts a new row into ER `tickets`.

The previous insert still failed with:

`null value in column "company_id" of relation "tickets" violates not-null constraint`

Even though the website attempted a valid `company_id`. This usually means the ER `tickets` table has a trigger that derives or validates `tickets.company_id` from `tickets.customer_id`. Since `customer_id` was previously null, the trigger could still produce a null `company_id`.

## What changed

Before inserting into ER `tickets`, the website now:

1. Reads the approved row from ER `portal_service_requests`.
2. Resolves the ER company ID from `portal_service_requests.company_id` or the configured fallback.
3. Finds an existing ER `customers` row by company + email/phone.
4. If no matching ER customer exists, creates a new row in ER `customers` using the portal request details.
5. Inserts the ER ticket with both:
   - `company_id`
   - `customer_id`
6. Updates `portal_service_requests.er_ticket_id`, `er_ticket_no`, and `last_synced_at`.

## Database structure changes

No table structure changes are required.

This patch does not add columns and does not alter/drop/delete existing ER tables.

It can create a new row in ER `customers` only when no matching customer is found, then creates a new row in ER `tickets` after approval.

## Ticket insert fields

The website inserts only safe ER ticket fields:

- `company_id`
- `ticket_no`
- `customer_id`
- `location_id = null`
- `assigned_tech_id = null`
- `ticket_source`
- `warranty`
- `manufacturer`
- `account = null`
- `claim_company = null`
- `model`
- `model_version`
- `serial`
- `product_type`
- `purchase_date`

It does not modify ER workflow/status fields.
