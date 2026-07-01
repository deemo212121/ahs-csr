import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    requireRole(context, ['csr', 'team_leader', 'csr_manager', 'admin']);

    const url = new URL(request.url);
    const ids = (url.searchParams.get('ids') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 500);

    if (!ids.length) return NextResponse.json({ presence: {} });

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, last_seen_at')
      .in('id', ids);

    if (error) throw new Error(error.message);

    const presence: Record<string, string | null> = {};
    for (const row of data ?? []) {
      presence[row.id as string] = row.last_seen_at as string | null;
    }

    return NextResponse.json({ presence });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load customer presence.' },
      { status: 400 },
    );
  }
}
