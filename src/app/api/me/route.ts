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
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          last_login_at: new Date().toISOString(),
        })
        .eq('id', localId);

      if (error) {
        console.error('Failed updating last_login_at:', error);
      }
    }

    return NextResponse.json({
      success: true,
      profile: context.profile,
      role: context.role,
      home: roleHome[context.role],
    });
  } catch (error) {
    console.error('========== AUTH ERROR ==========');
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to load current user.',
        stack:
          process.env.NODE_ENV !== 'production' && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 401 },
    );
  }
}