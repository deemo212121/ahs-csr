import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { listTicketMessageThreads } from '@/lib/messages';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['customer', 'csr', 'team_leader', 'csr_manager', 'admin']);

    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 80), 1), 200);
    const threads = await listTicketMessageThreads(getSupabaseAdmin(), auth, limit);

    return NextResponse.json({ threads });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load messages.' },
      { status: 400 },
    );
  }
}
