import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, localProfileId, requireRole, type AuthContext } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

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
  queued_at
`;

const patchSchema = z.object({
  action: z.enum(['accept', 'start', 'end', 'cancel', 'heartbeat']),
  reason: z.string().max(240).optional(),
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

function normalizeTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const fixedTimezone = trimmed.replace(
    /(\d|\.\d+)\s+([+-]?\d{2}:?\d{2})$/,
    (_match, prefix: string, timezone: string) => `${prefix}${timezone.startsWith('-') || timezone.startsWith('+') ? timezone : `+${timezone}`}`,
  );
  const parsed = new Date(fixedTimezone);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

function durationSeconds(startedAt?: string | null) {
  const normalizedStartedAt = normalizeTimestamp(startedAt);
  if (!normalizedStartedAt) return 0;
  const started = new Date(normalizedStartedAt).getTime();
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, Math.round((Date.now() - started) / 1000));
}

function missingCallSchemaMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (
    message.includes('Could not find') ||
    message.includes('column') ||
    message.includes('call_requests') ||
    message.includes('relation')
  ) {
    return 'Web call queue database setup is not installed yet. Run supabase/webrtc_call_queue_setup.sql in your main Supabase database.';
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
      .from('call_requests')
      .select(callSelect)
      .eq('id', id)
      .single();

    if (loadError || !call) throw new Error(loadError?.message ?? 'Call request was not found.');

    const isCustomerOwner = auth.role === 'customer' && call.customer_id === auth.profile.id;
    const isStaff = auth.role === 'csr' || auth.role === 'team_leader' || auth.role === 'csr_manager' || auth.role === 'admin';
    if (!isCustomerOwner && !isStaff) throw new Error('You do not have access to this call.');

    const now = new Date().toISOString();
    const acceptedAt = normalizeTimestamp(call.accepted_at);
    const callStartedAt = normalizeTimestamp(call.call_started_at);
    const staffJoinedAt = normalizeTimestamp(call.staff_joined_at);
    const customerJoinedAt = normalizeTimestamp(call.customer_joined_at);
    let updates: Record<string, unknown> = {};

    if (body.action === 'accept') {
      requireRole(auth, ['csr', 'team_leader', 'csr_manager', 'admin']);
      if (['completed', 'cancelled', 'missed'].includes(text(call.status))) {
        throw new Error('This call is no longer active.');
      }
      await supabaseAdmin
        .from('call_signals')
        .delete()
        .eq('call_request_id', id);
      updates = {
        status: 'accepted',
        browser_call_status: 'ringing',
        accepted_at: acceptedAt ?? now,
        accepted_by: localProfileId(auth),
        accepted_by_profile_id: staffProfileKey(auth),
        accepted_by_name: displayName(auth),
        accepted_by_role: auth.role,
        staff_joined_at: now,
        last_staff_seen_at: now,
      };
    }

    if (body.action === 'start') {
      updates = {
        browser_call_status: 'connected',
        call_started_at: callStartedAt ?? now,
        ...(isStaff ? { staff_joined_at: staffJoinedAt ?? now, last_staff_seen_at: now } : {}),
        ...(isCustomerOwner ? { customer_joined_at: customerJoinedAt ?? now, last_customer_seen_at: now } : {}),
      };
    }

    if (body.action === 'heartbeat') {
      updates = isStaff ? { last_staff_seen_at: now } : { last_customer_seen_at: now };
      if (isStaff && !staffJoinedAt) updates.staff_joined_at = now;
      if (isCustomerOwner && !customerJoinedAt) updates.customer_joined_at = now;
    }

    if (body.action === 'end' || body.action === 'cancel') {
      if (!isCustomerOwner && !isStaff) throw new Error('You do not have access to end this call.');
      const finalStatus = body.action === 'cancel' && isCustomerOwner && !call.call_started_at ? 'cancelled' : 'completed';
      updates = {
        status: finalStatus,
        browser_call_status: 'ended',
        completed_at: now,
        call_ended_at: now,
        call_duration_seconds: durationSeconds(callStartedAt),
        ended_by_profile_id: auth.role === 'customer' ? `local:${auth.profile.id}` : staffProfileKey(auth),
        ended_reason: body.reason || (finalStatus === 'cancelled' ? 'Customer cancelled before connection.' : 'Call ended.'),
      };
    }

    const { data, error } = await supabaseAdmin
      .from('call_requests')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ call: data });
  } catch (error) {
    const setupMessage = missingCallSchemaMessage(error);
    return NextResponse.json(
      { message: setupMessage || (error instanceof Error ? error.message : 'Unable to update call request.') },
      { status: 400 },
    );
  }
}
