# USHS PHP to TypeScript Migration Guide

## Target Architecture

```txt
Next.js + TypeScript
Firebase Authentication
Supabase PostgreSQL
Supabase Storage for uploads/recordings
```

This replaces:

```txt
PHP/cPanel
PHP sessions
MySQL/MariaDB/phpMyAdmin
local uploads folder
```

## What Is Implemented In This Starter

- Firebase email/password login page.
- Firebase ID token verification in server API routes.
- Role routing for:
  - `customer`
  - `csr`
  - `team_leader`
  - `csr_manager`
  - `admin`
- Supabase PostgreSQL schema converted from the important PHP/MySQL tables.
- Customer service request creation.
- CSR/team/manager/admin verification queue.
- Approve/reject request API.
- Approved ticket table.
- Initial manager call page placeholder for the WebRTC rewrite.

## Firebase Role Setup

Use Firebase custom claims when possible:

```json
{
  "role": "csr_manager"
}
```

Supported roles:

```txt
customer
csr
team_leader
csr_manager
admin
```

If a custom claim does not exist, the app reads the role from Supabase:

```txt
profiles.role
```

The Supabase row is matched by:

```txt
profiles.firebase_uid = Firebase user UID
```

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run:

```txt
supabase/schema.sql
```

4. Create Firebase users.
5. Create matching `profiles` rows in Supabase, or let the app create a `customer` profile on first login and update the role manually.

Example profile:

```sql
insert into profiles (firebase_uid, role, first_name, last_name, email)
values ('FIREBASE_UID_HERE', 'csr_manager', 'Manager', 'User', 'manager@example.com');
```

## Environment Setup

Copy:

```txt
.env.example
```

to:

```txt
.env.local
```

Fill:

```txt
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT_JSON
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## Run Locally

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Deploy

Recommended TypeScript hosting:

```txt
Vercel
Railway
Render
```

Set the same `.env.local` variables in the hosting provider environment settings.

## Still To Migrate From PHP

These are not fully rebuilt yet:

- Full customer profile editing.
- Full CSR/team/manager reporting.
- Full chat/messages system.
- Technician assignment workflows.
- Admin settings pages.
- Full WebRTC call room in TypeScript.
- Recording upload to Supabase Storage.
- Data migration scripts from MySQL dump to PostgreSQL.

## Recommended Next Steps

1. Confirm the final Supabase schema with the ER/TypeScript team.
2. Decide if old MySQL data must be migrated or if the new app starts fresh.
3. Build the WebRTC call room using TypeScript API routes and Supabase Storage.
4. Add admin screens for creating staff profiles and assigning roles.
5. Convert reports and manager dashboards after the ticket flow is stable.
