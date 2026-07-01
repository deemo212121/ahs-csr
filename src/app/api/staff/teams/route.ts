import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCsrStaffRoster } from '@/lib/staff/erStaffRoster';

export type StaffTeam = {
  leaderId: string;
  leaderName: string;
  memberIds: string[];
  memberNames: Record<string, string>;
};

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    requireRole(context, ['team_leader', 'csr_manager', 'admin']);

    const { teamLeaders, csrAgents } = await getCsrStaffRoster();

    const supabaseAdmin = getSupabaseAdmin();
    const { data: assignments, error } = await supabaseAdmin
      .from('csr_team_assignments')
      .select('csr_staff_id, team_leader_staff_id');

    if (error) throw new Error(error.message);

    const leaderIdByCsrId = new Map((assignments ?? []).map((row) => [row.csr_staff_id as string, row.team_leader_staff_id as string | null]));

    // A Team Leader's own staff id in the ER directory has to match her local
    // auth profile id for scoping to work — that's how the ER staff context
    // resolves context.profile.id for team_leader accounts.
    const leaderRows = context.role === 'team_leader'
      ? teamLeaders.filter((leader) => leader.id === context.profile.id)
      : teamLeaders;

    const teams: StaffTeam[] = leaderRows.map((leader) => {
      const members = csrAgents.filter((agent) => leaderIdByCsrId.get(agent.id) === leader.id);
      const memberIds = [leader.id, ...members.map((member) => member.id)];
      const memberNames: Record<string, string> = { [leader.id]: leader.name };
      members.forEach((member) => {
        memberNames[member.id] = member.name;
      });
      return { leaderId: leader.id, leaderName: leader.name, memberIds, memberNames };
    });

    if (context.role !== 'team_leader') {
      const unassignedCsrs = csrAgents.filter((agent) => !leaderIdByCsrId.get(agent.id));
      if (unassignedCsrs.length) {
        const memberNames: Record<string, string> = {};
        unassignedCsrs.forEach((agent) => {
          memberNames[agent.id] = agent.name;
        });
        teams.push({
          leaderId: 'unassigned',
          leaderName: 'Unassigned',
          memberIds: unassignedCsrs.map((agent) => agent.id),
          memberNames,
        });
      }
    }

    return NextResponse.json({ teams });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load team structure.' },
      { status: 400 },
    );
  }
}
