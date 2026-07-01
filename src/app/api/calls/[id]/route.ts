import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, requireRole, type AuthContext } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { NOTIFY_CHANNELS, pingChannel } from '@/lib/notifications/broadcast';

const callSelect = `
  id,
  customer_id,
  status,
  accepted_at,
  call_started_at,
  accepted_by_profile_id,
  accepted_by_name,
  accepted_by_role,
  staff_joined_at,
  customer_joined_at,
  queued_at,
  notes
`;

const patchSchema = z.object({
  action: z.enum(['accept', 'start', 'end', 'cancel', 'heartbeat', 'add_note']),
  reason: z.string().max(240).optional(),
  note: z.string().max(1000).optional(),
});

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function staffProfileKey(context: AuthContext) {
  return `${context.profileSource}:${context.profile.id}`;
}

function displayName(context: AuthContext) {
  return [context.profile.first_name, context.profile.last_name].filter(Boolean).join(' ') || context.profile.email || 'Staff';
}

function durationSeconds(startedAt?: string | null) {
  if (!startedAt) return 0;
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, Math.round((Date.now() - started) / 1000));
}

function missingCallSchemaMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (
    message.includes('Could not find') ||
    message.includes('column') ||
    message.includes('rtc_calls') ||
    message.includes('relation')
  ) {
    return 'Web call queue database setup is not installed yet. Run supabase/rtc_calls_setup.sql in your main Supabase database.';
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['customer', 'csr', 'team_leader', 'csr_manager', 'admin']);

    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());
    const supabaseAdmin = getSupabaseAdmin();
    const { data: call, error: loadError } = await supabaseAdmin
      .from('rtc_calls')
      .select(callSelect)
      .eq('id', id)
      .single();

    if (loadError || !call) throw new Error(loadError?.message ?? 'Call request was not found.');

    const isCustomerOwner = auth.role === 'customer' && call.customer_id === auth.profile.id;
    const isStaff = auth.role === 'csr' || auth.role === 'team_leader' || auth.role === 'csr_manager' || auth.role === 'admin';
    if (!isCustomerOwner && !isStaff) throw new Error('You do not have access to this call.');

    const now = new Date().toISOString();
    let updates: Record<string, unknown> = {};

    if (body.action === 'accept') {
      requireRole(auth, ['csr', 'team_leader', 'csr_manager', 'admin']);
      if (['completed', 'cancelled', 'missed'].includes(text(call.status))) {
        throw new Error('This call is no longer active.');
      }
      // Guard against two CSRs accepting the same call at nearly the same time —
      // once someone has claimed it, everyone else gets a clear "who has it" message.
      if (call.status === 'accepted' && call.accepted_by_profile_id !== staffProfileKey(auth)) {
        throw new Error(`${text(call.accepted_by_name) || 'Another CSR'} is handling this call.`);
      }
      await supabaseAdmin
        .from('rtc_signals')
        .delete()
        .eq('call_id', id);
      updates = {
        status: 'accepted',
        accepted_at: call.accepted_at ?? now,
        accepted_by_profile_id: staffProfileKey(auth),
        accepted_by_name: displayName(auth),
        accepted_by_role: auth.role,
        staff_joined_at: now,
        last_staff_seen_at: now,
      };
    }

    if (body.action === 'start') {
      updates = {
        call_started_at: call.call_started_at ?? now,
        ...(isStaff ? { staff_joined_at: call.staff_joined_at ?? now, last_staff_seen_at: now } : {}),
        ...(isCustomerOwner ? { customer_joined_at: call.customer_joined_at ?? now, last_customer_seen_at: now } : {}),
      };
    }

    if (body.action === 'heartbeat') {
      updates = isStaff ? { last_staff_seen_at: now } : { last_customer_seen_at: now };
      if (isStaff && !call.staff_joined_at) updates.staff_joined_at = now;
      if (isCustomerOwner && !call.customer_joined_at) updates.customer_joined_at = now;
    }

    if (body.action === 'add_note') {
      requireRole(auth, ['csr', 'team_leader', 'csr_manager', 'admin']);
      if (text(call.status) !== 'completed') {
        throw new Error('Notes can only be added to a completed call.');
      }
      if (call.accepted_by_profile_id !== staffProfileKey(auth)) {
        throw new Error('Only the CSR who answered this call can add a note.');
      }
      if (text(call.notes)) {
        throw new Error('A note has already been added to this call and cannot be changed.');
      }
      const note = (body.note || '').trim();
      if (!note) throw new Error('Note cannot be empty.');
      updates = { notes: note };
    }

    if (body.action === 'end' || body.action === 'cancel') {
      if (!isCustomerOwner && !isStaff) throw new Error('You do not have access to end this call.');
      const finalStatus = body.action === 'cancel' && isCustomerOwner && !call.call_started_at ? 'cancelled' : 'completed';
      updates = {
        status: finalStatus,
        call_ended_at: now,
        call_duration_seconds: durationSeconds(call.call_started_at),
        ended_by_profile_id: auth.role === 'customer' ? `local:${auth.profile.id}` : staffProfileKey(auth),
        ended_reason: body.reason || (finalStatus === 'cancelled' ? 'Customer cancelled before connection.' : 'Call ended.'),
      };
    }

    const { data, error } = await supabaseAdmin
      .from('rtc_calls')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    if (body.action === 'accept' || body.action === 'end' || body.action === 'cancel') {
      await pingChannel(NOTIFY_CHANNELS.calls);
    }
    return NextResponse.json({ call: data });
  } catch (error) {
    const setupMessage = missingCallSchemaMessage(error);
    return NextResponse.json(
      { message: setupMessage || (error instanceof Error ? error.message : 'Unable to update call request.') },
      { status: 400 },
    );
  }
}
