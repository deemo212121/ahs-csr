-- Run this AFTER branches_setup.sql (same Supabase project, main AHS-CSR project, not ER).
-- Adds a soft "listed / unlisted" toggle to branches, separate from deleting
-- them outright — an unlisted branch stays in the table (so it can be
-- re-listed later) but disappears from every CSR/manager/etc. branch filter
-- checklist immediately.
alter table public.branches
  add column if not exists is_listed boolean not null default true;

create index if not exists branches_is_listed_idx on public.branches(is_listed);
