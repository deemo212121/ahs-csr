import { getErSupabaseAdmin, isErSupabaseConfigured } from '@/lib/supabase/er-admin';

// The staff directory (CSR_AGENT / CSR_TEAM_LEADER accounts) lives in the ER
// Supabase profiles table, not this app's local database, so team roster
// reads have to go through the ER connection. See admin/catalogs/route.ts
// for the original allowedStaffRole/getErStaffProfiles logic this mirrors.

export type CsrStaffMember = {
  id: string;
  name: string;
  email: string | null;
  branch: string | null;
};

function tableName(envName: string, fallback: string) {
  return process.env[envName]?.trim() || fallback;
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function roleFamily(role: unknown): 'agent' | 'team_leader' | null {
  const raw = textValue(role) ?? '';
  const upper = raw.toUpperCase();
  if (upper === 'CSR_AGENT') return 'agent';
  if (upper === 'CSR_TEAM_LEADER') return 'team_leader';
  return null;
}

export async function getCsrStaffRoster(): Promise<{ teamLeaders: CsrStaffMember[]; csrAgents: CsrStaffMember[] }> {
  if (!isErSupabaseConfigured()) {
    return { teamLeaders: [], csrAgents: [] };
  }

  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase) {
    return { teamLeaders: [], csrAgents: [] };
  }

  const profilesTable = tableName('ER_PROFILES_TABLE', 'profiles');
  let query = erSupabase
    .from(profilesTable)
    .select('id, email, username, display_name, role, is_active, assigned_branch, branch_access')
    .eq('is_active', true)
    .order('display_name', { ascending: true })
    .limit(1000);

  if (process.env.ER_TICKET_VIEW_COMPANY_ID?.trim()) {
    query = query.eq('company_id', process.env.ER_TICKET_VIEW_COMPANY_ID.trim());
  }

  const { data, error } = await query;
  if (error) throw new Error(`Unable to load ER staff profiles: ${error.message}`);

  const teamLeaders: CsrStaffMember[] = [];
  const csrAgents: CsrStaffMember[] = [];

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const family = roleFamily(row.role);
    if (!family) continue;

    const member: CsrStaffMember = {
      id: String(row.id),
      name: textValue(row.display_name) || textValue(row.username) || textValue(row.email) || 'Unnamed staff',
      email: textValue(row.email),
      branch: textValue(row.assigned_branch) || textValue(row.branch_access),
    };

    if (family === 'team_leader') teamLeaders.push(member);
    else csrAgents.push(member);
  }

  return { teamLeaders, csrAgents };
}
