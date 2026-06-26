# Admin Portal + Service Areas Update

This version focuses on the Admin portal and the ZIP/service-area autofill foundation.

## What changed

- Restored the PHP-style admin header with fixed top bar.
- Restored the sidebar behavior from PHP: hidden by default and opened with the hamburger button.
- Added the PHP-style account dropdown with Settings and Logout.
- Reworked Admin Dashboard cards to match the PHP metric layout better.
- Rebuilt Admin > Cities as **Service Areas & ZIP Coverage** using the `service_areas` master table.
- Added `/api/service-areas` for:
  - ZIP lookup/autofill.
  - Admin add/update of ZIP coverage.
- Added customer/manual request ZIP autofill from Supabase.
- Added `supabase/service_areas_seed.sql` converted from the uploaded MySQL database dump.

## SQL order in Supabase

Run these in Supabase SQL Editor:

1. `supabase/schema.sql`
2. `supabase/service_areas_seed.sql`

The seed file contains:

- 5,275 ZIP coverage rows
- 2,811 distinct city names
- 28 regions

## Autofill behavior

When a user enters a 5-digit ZIP code in a service request form, the app checks:

```txt
/api/service-areas?zip=30002
```

If a match is found, it auto-fills:

- City
- State
- Region

If multiple active locations share the same ZIP, the form shows a dropdown to choose the correct city/region.
