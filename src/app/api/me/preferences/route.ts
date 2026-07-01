import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const preferencesSchema = z.object({
  filterRegions: z.array(z.string()).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth.firebaseUid) {
      return NextResponse.json({ success: false, message: 'No account linked to save preferences against.' }, { status: 400 });
    }

    const body = preferencesSchema.parse(await request.json());
    const currentPreferences = (auth.profile.preferences && typeof auth.profile.preferences === 'object')
      ? auth.profile.preferences
      : {};
    const nextPreferences = { ...currentPreferences, ...body };

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('user_preferences')
      .upsert(
        { firebase_uid: auth.firebaseUid, preferences: nextPreferences, updated_at: new Date().toISOString() },
        { onConflict: 'firebase_uid' },
      )
      .select('preferences')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, preferences: data?.preferences ?? nextPreferences });
  } catch (error) {
    console.error('Failed updating user preferences:', error);
    const message = error instanceof Error
      ? error.message
      : (error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : 'Unable to update preferences.');
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
