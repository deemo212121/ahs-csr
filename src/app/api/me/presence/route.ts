import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, localProfileId } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    const localId = localProfileId(context);
    if (!localId) return NextResponse.json({ ok: true });

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', localId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to update presence.' },
      { status: 400 },
    );
  }
}
