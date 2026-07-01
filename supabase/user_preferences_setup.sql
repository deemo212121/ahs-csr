-- Per-user app preferences (e.g. the saved branch/region filter), keyed by
-- Firebase UID so it works for every profile source (local profiles table,
-- ER staff profiles, test login) without touching the ER database.
-- Safe scope: this only touches this new table in the LOCAL Supabase project
-- (the one referenced by NEXT_PUBLIC_SUPABASE_URL), not the ER Supabase project.
create table if not exists public.user_preferences (
  firebase_uid text primary key,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
