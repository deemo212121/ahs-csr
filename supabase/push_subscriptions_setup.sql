-- Web Push subscriptions — one row per browser/device that's opted in.
-- profile_id is a bare id shared across two different databases (local
-- customer profiles vs ER staff profiles), so profile_source disambiguates
-- which one it points at, same pattern AuthContext already uses elsewhere.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  profile_source text not null check (profile_source in ('local', 'er', 'test')),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_profile_idx
  on public.push_subscriptions(profile_id, profile_source);

alter table public.push_subscriptions enable row level security;
