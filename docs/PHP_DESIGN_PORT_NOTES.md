# PHP Design Port Notes

This starter keeps the TypeScript/Firebase/Supabase architecture, but the visual design has been adjusted to match the original PHP portal style more closely.

## What changed

- Login page restored to the original PHP-style card:
  - USHS Portal header
  - logo circle
  - email/password fields
  - show/hide password icon
  - Remember Me checkbox
  - Login button
  - Create Customer Account button
- Removed the visible quick-testing buttons from the login page.
- Sample accounts still work by typing them manually, for local development only.
- Added `/customer/register` for the customer account button.
- Copied the PHP Admin Hub/USHS logo into `public/admin-hub-logo.png` and `public/ushs_logo.png`.
- Added CSS overrides in `src/styles/globals.css` to match the PHP dark glass theme for:
  - Customer portal
  - CSR portal
  - Team Leader portal
  - CSR Manager portal
  - Admin portal
- Admin sidebar now behaves more like the PHP version: hidden by default and opened from the hamburger button.

## Login behavior

The login page is unified, just like the PHP version:

1. Local sample credentials are checked first.
2. Staff/Admin login uses Firebase Authentication.
3. Customer login uses Supabase Authentication.

## Local sample accounts

Use these only for `npm run dev` testing:

```txt
admin@ushs.local / password123
manager@ushs.local / password123
leader@ushs.local / password123
csr@ushs.local / password123
customer@ushs.local / password123
bubblemax@gmail.com / password123
murray.lorico10@gmail.com / password123
```

## Important note

This is a design/UI port foundation. It does not mean every PHP business function has already been fully rebuilt in TypeScript. Some pages are still TypeScript starter pages that use the PHP-inspired UI styling while the remaining business logic can be migrated feature by feature.
