import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, localProfileId } from '@/lib/auth/server';
import { roleHome } from '@/lib/types';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    const supabaseAdmin = getSupabaseAdmin();

    const localId = localProfileId(context);
    if (localId) {
      await supabaseAdmin
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', localId);
    }

    return NextResponse.json({
      profile: context.profile,
      role: context.role,
      home: roleHome[context.role],
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load current user.' },
      { status: 401 },
    );
  }
}
