import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = subscribeSchema.parse(await request.json());
    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
      {
        profile_id: auth.profile.id,
        profile_source: auth.profileSource,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      { onConflict: 'endpoint' },
    );

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to save push subscription.' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await getAuthContext(request);
    const { endpoint } = await request.json();
    if (typeof endpoint !== 'string') throw new Error('Missing endpoint.');

    const supabaseAdmin = getSupabaseAdmin();
    await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to remove push subscription.' },
      { status: 400 },
    );
  }
}
