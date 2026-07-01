-- Team Management: maps a CSR_AGENT to a CSR_TEAM_LEADER.
-- Staff accounts (CSR_AGENT / CSR_TEAM_LEADER) live in the ER Supabase
-- profiles table, which this app does not own and cannot alter. So the
-- assignment is stored here instead, keyed by the ER staff profile id.
-- Run this in the Supabase SQL editor (main app database).

create table if not exists csr_team_assignments (
  csr_staff_id text primary key,
  team_leader_staff_id text,
  updated_at timestamptz not null default now()
);

create index if not exists csr_team_assignments_leader_idx on csr_team_assignments(team_leader_staff_id);
