# USHS TypeScript Rebuild

This is the TypeScript/Next.js rebuild starter for the PHP/cPanel USHS portal.

Target stack:

- Next.js App Router + TypeScript
- Firebase Authentication for staff only: CSR, Team Leader, CSR Manager, Admin
- Supabase Auth + Supabase PostgreSQL for customer accounts and app data
- Supabase PostgreSQL for tickets, verification queue, call queue, notifications, teams, catalog tables
- Local development with `npm run dev`
- Later deployment to Cloudflare Workers using the OpenNext Cloudflare adapter

## What was adjusted

This version is aligned with the requested login/database split:

- Staff login uses Firebase.
- Customer login/sign-up uses Supabase Auth.
- The `profiles` table now supports either `firebase_uid` for staff or `supabase_user_id` for customers.
- Local test login still works even when Firebase and Supabase are not configured.
- The login page now has separate Staff/Admin and Customer tabs.
- API routes accept Firebase staff tokens, Supabase customer tokens, and local test tokens.

## First local setup

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000/login
```

For local testing without real Firebase/Supabase keys, use the quick buttons on the login page, or use:

```txt
admin@ushs.local / password123
manager@ushs.local / password123
leader@ushs.local / password123
csr@ushs.local / password123
customer@ushs.local / password123
```

## Database setup

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. Copy `.env.example` to `.env.local`.
5. Add Supabase and Firebase values.
6. Restart `npm run dev` after editing `.env.local`.

## Environment variables

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_SERVICE_ACCOUNT_JSON=
```

You can also use the individual Firebase Admin fields in `.env.example` instead of `FIREBASE_SERVICE_ACCOUNT_JSON`.

## Role routing

```txt
admin -> /admin/dashboard
csr_manager -> /manager/dashboard
team_leader -> /team-leader/dashboard
csr -> /csr/dashboard
customer -> /customer/dashboard
```

Staff roles should be controlled from Firebase custom claims or from `profiles.role` in Supabase. Customer accounts should stay as Supabase Auth users with a `profiles.role = 'customer'` row.


## Current ER ticket sync flow

This build uses the safer flow where customer verification stays in your own database first. Do **not** run ER SQL setup files for this flow.

```txt
Customer submits request -> YOUR Supabase service_requests -> Verification tab -> Approve -> insert approved ticket into THEIR existing public.tickets table
```

Keep this in `.env.local`:

```env
TICKET_DATABASE_MODE=local
ER_SUPABASE_TICKETS_TABLE=tickets
ER_DEFAULT_CUSTOMER_ID=
```

`ER_DEFAULT_CUSTOMER_ID` can stay blank because their `tickets.customer_id` is nullable. See `docs/LOCAL_VERIFICATION_TO_ER_TICKETS_SETUP.md`.

## Cloudflare later

For local coding, keep using:

```bash
npm run dev
```

When you are ready to deploy the full Next.js app on Cloudflare, use Cloudflare Workers with the OpenNext adapter rather than static Pages only, because this app has API routes and server-side token verification.

See `docs/LOCAL_DATABASE_CLOUDFLARE_GUIDE.md` for the step-by-step explanation.
