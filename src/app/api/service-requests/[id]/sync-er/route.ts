import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { syncApprovedRequestToEr } from '@/lib/er-sync';
import { retryErModeSync, useErTicketDatabase } from '@/lib/er-ticket-database';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['csr', 'team_leader', 'csr_manager', 'admin']);

    const { id } = await context.params;

    if (useErTicketDatabase()) {
      const sync = await retryErModeSync(auth, id);
      return NextResponse.json({ sync });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: existing, error } = await supabaseAdmin
      .from('service_requests')
      .select('id, verification_status')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    if (existing?.verification_status !== 'approved') {
      throw new Error('Only approved requests can be synced to ER.');
    }

    const sync = await syncApprovedRequestToEr(supabaseAdmin, id);

    const { data: refreshedRequest } = await supabaseAdmin
      .from('service_requests')
      .select('id, request_number, verification_status, sync_status, er_ticket_id, sync_error, last_synced_at')
      .eq('id', id)
      .single();

    return NextResponse.json({ request: refreshedRequest, sync });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to sync request to ER.' },
      { status: 400 },
    );
  }
}
