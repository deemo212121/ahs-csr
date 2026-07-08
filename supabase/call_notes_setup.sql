-- Multiple timestamped notes per call, instead of the old single
-- rtc_calls.notes field that could only ever be set once. Existing values
-- already saved in rtc_calls.notes are left in place (still shown in the UI
-- as a legacy, undated note) — nothing is migrated or deleted.
create table if not exists public.call_notes (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.rtc_calls(id) on delete cascade,
  author_profile_id text not null,
  author_name text,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists call_notes_call_idx on public.call_notes(call_id, created_at);

alter table public.call_notes enable row level security;
