import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, requireRole, type AuthContext } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const signalSchema = z.object({
  type: z.enum(['ready', 'offer', 'answer', 'ice-candidate', 'hangup']),
  payload: z.record(z.unknown()).optional().default({}),
});

function staffProfileKey(context: AuthContext) {
  return `${context.profileSource}:${context.profile.id}`;
}

function senderKey(context: AuthContext) {
  return context.role === 'customer' ? `local:${context.profile.id}` : staffProfileKey(context);
}

async function assertCanAccessCall(callId: string, auth: AuthContext) {
  const { data, error } = await getSupabaseAdmin()
    .from('call_requests')
    .select('id, customer_id, status, accepted_by_profile_id')
    .eq('id', callId)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Call request was not found.');

  if (auth.role === 'customer') {
    if (data.customer_id !== auth.profile.id) throw new Error('You do not have access to this call.');
    return data;
  }

  requireRole(auth, ['csr', 'team_leader', 'csr_manager', 'admin']);
  return data;
}

function missingCallSchemaMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (
    message.includes('Could not find') ||
    message.includes('column') ||
    message.includes('call_signals') ||
    message.includes('relation')
  ) {
    return 'WebRTC signal table is not installed yet. Run supabase/webrtc_call_queue_setup.sql in your main Supabase database.';
  }
  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['customer', 'csr', 'team_leader', 'csr_manager', 'admin']);

    const { id } = await context.params;
    await assertCanAccessCall(id, auth);

    const url = new URL(request.url);
    const after = url.searchParams.get('after');
    let query = getSupabaseAdmin()
      .from('call_signals')
      .select('id, call_request_id, sender_profile_id, sender_role, signal_type, payload, created_at')
      .eq('call_request_id', id)
      .order('created_at', { ascending: true })
      .limit(200);

    if (after) query = query.gt('created_at', after);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ signals: data ?? [] });
  } catch (error) {
    const setupMessage = missingCallSchemaMessage(error);
    return NextResponse.json(
      { message: setupMessage || (error instanceof Error ? error.message : 'Unable to load call signals.') },
      { status: 400 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['customer', 'csr', 'team_leader', 'csr_manager', 'admin']);

    const { id } = await context.params;
    await assertCanAccessCall(id, auth);

    const body = signalSchema.parse(await request.json());
    const { data, error } = await getSupabaseAdmin()
      .from('call_signals')
      .insert({
        call_request_id: id,
        sender_profile_id: senderKey(auth),
        sender_role: auth.role === 'customer' ? 'customer' : 'staff',
        signal_type: body.type,
        payload: body.payload,
      })
      .select('id, call_request_id, sender_profile_id, sender_role, signal_type, payload, created_at')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ signal: data }, { status: 201 });
  } catch (error) {
    const setupMessage = missingCallSchemaMessage(error);
    return NextResponse.json(
      { message: setupMessage || (error instanceof Error ? error.message : 'Unable to send call signal.') },
      { status: 400 },
    );
  }
}
