import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCsrStaffRoster } from '@/lib/staff/erStaffRoster';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    requireRole(context, ['csr_manager', 'admin']);

    const { teamLeaders, csrAgents } = await getCsrStaffRoster();

    const supabaseAdmin = getSupabaseAdmin();
    const { data: assignments, error } = await supabaseAdmin
      .from('csr_team_assignments')
      .select('csr_staff_id, team_leader_staff_id');

    if (error) throw new Error(error.message);

    const assignmentByCsrId = new Map((assignments ?? []).map((row) => [row.csr_staff_id as string, row.team_leader_staff_id as string | null]));

    return NextResponse.json({
      teamLeaders: teamLeaders.map((leader) => ({ id: leader.id, name: leader.name, email: leader.email })),
      csrAgents: csrAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        email: agent.email,
        branch: agent.branch,
        team_leader_id: assignmentByCsrId.get(agent.id) ?? null,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load team management data.' },
      { status: 400 },
    );
  }
}

const assignSchema = z.object({
  csr_id: z.string().min(1),
  team_leader_id: z.string().min(1).nullable(),
});

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    requireRole(context, ['csr_manager', 'admin']);

    const body = assignSchema.parse(await request.json());
    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from('csr_team_assignments')
      .upsert({
        csr_staff_id: body.csr_id,
        team_leader_staff_id: body.team_leader_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'csr_staff_id' });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to update team assignment.' },
      { status: 400 },
    );
  }
}
