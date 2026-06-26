# Admin Portal Fix Pass

This pass focuses on the PHP-style Admin portal pages the user flagged:

- Admin sidebar now opens with a visible US In Home Services logo, title, and Admin Console label.
- Admin Customers page is no longer a placeholder. It loads customer profiles from Supabase and includes totals, search, status, request count, and Activate/Deactivate actions.
- Admin Requests page now uses the PHP-style Service Requests layout with counters, search, table columns, status pill, and action buttons.
- Admin Settings page now matches the PHP layout with Admin Settings hero, System Admin profile card, Admin Profile form, and Change Password form styling.
- Cities API now paginates Supabase results by 1,000 rows so the UI can load all 5,275 legacy ZIP rows instead of being capped at 1,000 by Supabase REST defaults.
- Cities page now includes an Individual ZIP Records section with first-20 clean mode and View All records toggle.

## Important SQL order

Run these in Supabase SQL Editor:

1. `supabase/schema.sql`
2. `supabase/service_areas_seed.sql`
3. `supabase/admin_catalog_seed.sql`
4. `supabase/admin_customer_request_seed.sql`

## Check the city coverage count

After running `service_areas_seed.sql`, run this in Supabase SQL Editor:

```sql
select
  count(*) as zip_rows,
  count(distinct region) as regions,
  count(distinct city) as cities
from service_areas;
```

Expected from the legacy database:

- `zip_rows`: 5275
- `regions`: 28
- `cities`: around 2811 distinct city names

If Supabase shows only around 1,000 rows, rerun the full `service_areas_seed.sql`. If Supabase shows 5,275 rows but the page only shows 1,000, the old API code was still being used; this update fixes that with pagination.
