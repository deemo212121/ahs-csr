# Admin Brands, Appliances, Activity Logs, and Registration Update

This update focuses on the PHP admin portal style and database-backed admin catalog pages.

## Implemented

- Admin **Brands** page rebuilt to match the PHP layout:
  - dark header card
  - 4 summary stat cards
  - Add New Brand panel
  - editable brand list table
  - request count pills
  - save/delete action buttons

- Admin **Appliances** page rebuilt to match the PHP layout:
  - dark header card
  - 4 summary stat cards
  - Add New Appliance panel
  - editable appliance name and sort order
  - request count pills
  - save/delete action buttons

- Admin **Activity Logs** page rebuilt to match the PHP layout:
  - header card
  - Back and Refresh buttons
  - total logs, logs today, status changes, and tickets touched stats
  - easy-mode explanation bar
  - search and action filter
  - PHP-style log cards with date, action tags, actor info, and See change button

- Customer **Registration** page rebuilt to match the PHP page:
  - purple/blue top header
  - first/last name fields
  - email and phone fields with icons
  - password/confirm password
  - password strength bar
  - service address
  - ZIP lookup with region/city/state autofill
  - Terms and Conditions modal
  - Privacy Policy modal
  - checkbox stays disabled until both Terms and Privacy are opened/reviewed

## Database files

Run the SQL in this order:

1. `supabase/schema.sql`
2. `supabase/service_areas_seed.sql`
3. `supabase/admin_catalog_seed.sql`

If you already ran the earlier schema, still run `supabase/admin_catalog_seed.sql` because it also includes compatibility migrations for:

- profile address fields
- brand/appliance `updated_at`
- `request_logs`
- brand seed data
- appliance seed data
- activity log seed data

## API added

Admin catalog API:

```txt
/api/admin/catalogs?type=brands
/api/admin/catalogs?type=appliances
/api/admin/catalogs?type=activity-logs
```

ZIP autofill still uses:

```txt
/api/service-areas?zip=30002
```

## Notes

The admin pages now use the Supabase tables for brands, appliances, and request logs. The save/delete actions are implemented for brands and appliances. Activity logs are read-only for now, just like an audit trail.
