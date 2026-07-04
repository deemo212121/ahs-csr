import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, localProfileId } from '@/lib/auth/server';
import { roleHome } from '@/lib/types';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const updateProfileSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  phone_number: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  region: z.string().optional(),
  zip_code: z.string().optional(),
});

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

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    const localId = localProfileId(context);
    if (!localId) throw new Error('This account has no editable profile record.');

    const patch = updateProfileSchema.parse(await request.json());
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) update[key] = value || null;
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(update)
      .eq('id', localId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, profile: data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to update profile.',
      },
      { status: 400 },
    );
  }
}