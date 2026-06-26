# USHS Local, Database, and Cloudflare Guide

## 1. What this project is now

This is not PHP anymore. It is a TypeScript/Next.js starter that keeps the same portal idea:

- Admin portal
- CSR Manager portal
- Team Leader portal
- CSR portal
- Customer portal
- Customer request form
- CSR verification queue
- Tickets/request table
- Calls page foundation

The old PHP files are still useful as the reference system, but the TypeScript app should slowly replace PHP page by page.

## 2. Login and account plan

Use two account systems:

| User type | Login system | Database profile |
|---|---|---|
| Admin | Firebase Authentication | Supabase `profiles.firebase_uid` |
| CSR Manager | Firebase Authentication | Supabase `profiles.firebase_uid` |
| Team Leader | Firebase Authentication | Supabase `profiles.firebase_uid` |
| CSR Agent | Firebase Authentication | Supabase `profiles.firebase_uid` |
| Customer | Supabase Auth | Supabase `profiles.supabase_user_id` |

Why this setup works:

- Staff accounts can be controlled by Firebase Admin/custom claims.
- Customers do not need Firebase staff access.
- Supabase remains the main database for tickets, calls, messages, verification, and customer records.

## 3. Run locally first

Install packages:

```bash
npm install
```

Start local development:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000/login
```

You can use local test login before setting up Firebase/Supabase:

```txt
admin@ushs.local / password123
manager@ushs.local / password123
leader@ushs.local / password123
csr@ushs.local / password123
customer@ushs.local / password123
```

The quick testing buttons on the login page also work.

## 4. Connect Supabase

Create a Supabase project, then go to SQL Editor and run:

```txt
supabase/schema.sql
```

After that, copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill these values from Supabase:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Use the anon key only for browser/customer login. Use the service role key only on the server API routes. Do not expose the service role key in client components.

## 5. Connect Firebase for staff

In Firebase Console:

1. Create or open the project.
2. Enable Authentication.
3. Enable Email/Password sign-in.
4. Register a Web App to get the public client config.
5. Create staff users.
6. Add Firebase Admin service account credentials to `.env.local`.

Fill these browser values:

```txt
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Fill one Firebase Admin option:

```txt
FIREBASE_SERVICE_ACCOUNT_JSON=
```

Or:

```txt
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

For role routing, use either Firebase custom claims named `role`, or manually create/update the matching Supabase `profiles` row with the correct role:

```txt
admin
csr_manager
team_leader
csr
```

## 6. Customer login/sign-up

Customers use Supabase Auth. The login page Customer tab calls Supabase email/password login.

When a customer signs up, `supabase/schema.sql` creates a trigger on `auth.users` that automatically inserts a `profiles` row with:

```txt
role = customer
supabase_user_id = auth.users.id
firebase_uid = null
```

This keeps customers separate from Firebase staff accounts.

## 7. How requests work

Customer or CSR creates a request through:

```txt
POST /api/service-requests
```

Customer-created tickets are inserted as:

```txt
verification_status = pending
source_system = php_cx
origin_type = Customer App
```

CSR/manual tickets are inserted as:

```txt
verification_status = approved
source_system = php_csr
origin_type = Manual Ticket
```

CSR/TL/Manager/Admin can approve or reject pending customer tickets through:

```txt
POST /api/service-requests/{id}/review
```

## 8. About the old MySQL dump

Your uploaded MySQL dump has many PHP-era tables, including customers, csr_users, service_requests, call_requests, call_logs, chat tables, notifications, service areas, brands, appliances, teams, and technicians.

The starter Supabase schema covers the core rebuild tables first:

```txt
profiles
brands
appliance_types
job_statuses
service_areas
service_requests
request_status_history
notifications
csr_teams
csr_team_members
call_requests
call_logs
```

The next migration step is data import, not UI conversion. Usually this means:

1. Import catalog data first: brands, appliance types, job statuses, service areas.
2. Import accounts: customers and csr_users into profiles.
3. Import tickets: service_requests and request_status_history.
4. Import calls: call_requests and call_logs.
5. Import chat/messages after ticket IDs are mapped.

## 9. Cloudflare later

Because this app uses Next.js API routes, server-side Supabase service role access, and Firebase Admin verification, do not deploy it as a purely static site.

Use Cloudflare Workers with the OpenNext Cloudflare adapter.

Later setup will look like this:

```bash
npm i @opennextjs/cloudflare@latest
npm i -D wrangler@latest
```

Then add Cloudflare/OpenNext scripts and `wrangler.jsonc`. The important Cloudflare settings are:

```txt
compatibility_flags = ["nodejs_compat"]
main = ".open-next/worker.js"
assets.directory = ".open-next/assets"
```

Add all `.env.local` values into Cloudflare Worker secrets/build variables before deploying.

## 10. Recommended rebuild order

Do not convert everything at once. Rebuild in this order:

1. Login and role routing
2. Customer request form
3. Verification Queue
4. Tickets table
5. Manual ticket
6. Messages/chat
7. Calls/WebRTC
8. Admin staff management
9. Reports/dashboard graphs
10. ER/TypeScript API sync

This avoids breaking the whole system while moving from PHP/MySQL to TypeScript/Supabase.
