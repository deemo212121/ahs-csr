import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, localProfileId, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { syncApprovedRequestToEr } from '@/lib/er-sync';
import { NOTIFY_CHANNELS, pingChannel } from '@/lib/notifications/broadcast';
import { reviewErModePortalRequest, useErTicketDatabase } from '@/lib/er-ticket-database';
import { ensureErPortalRequestMessageThread, ensureTicketMessageThread } from '@/lib/messages';

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reject_reason: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['csr', 'team_leader', 'csr_manager', 'admin']);

    const { id } = await context.params;
    const body = reviewSchema.parse(await request.json());

    if (useErTicketDatabase()) {
      if (body.action === 'reject' && !body.reject_reason) {
        throw new Error('Reject reason is required.');
      }

      const result = await reviewErModePortalRequest(auth, id, body);
      if (body.action === 'approve') {
        const supabaseAdmin = getSupabaseAdmin();
        await ensureErPortalRequestMessageThread(supabaseAdmin, result.request);
      }
      await pingChannel(NOTIFY_CHANNELS.verify);
      return NextResponse.json(result);
    }

    const supabaseAdmin = getSupabaseAdmin();
    const reviewerProfileId = localProfileId(auth);

    if (body.action === 'reject' && !body.reject_reason) {
      throw new Error('Reject reason is required.');
    }

    const update =
      body.action === 'approve'
        ? {
            verification_status: 'approved',
            verification_reviewed_by: reviewerProfileId,
            verification_reviewed_at: new Date().toISOString(),
            verification_reject_reason: null,
            verification_notes: body.notes || 'Request verified and approved.',
            is_fake_ticket: false,
          }
        : {
            verification_status: 'rejected',
            verification_reviewed_by: reviewerProfileId,
            verification_reviewed_at: new Date().toISOString(),
            verification_reject_reason: body.reject_reason,
            verification_notes: body.notes || null,
            is_fake_ticket: true,
          };

    const { data, error } = await supabaseAdmin
      .from('service_requests')
      .update(update)
      .eq('id', id)
      .eq('verification_status', 'pending')
      .select('id, request_number, verification_status, sync_status, er_ticket_id, sync_error, last_synced_at')
      .single();

    if (error) throw new Error(error.message);

    await supabaseAdmin.from('request_status_history').insert({
      request_id: id,
      changed_by: reviewerProfileId,
      notes:
        body.action === 'approve'
          ? 'Request verified and approved.'
          : `Request rejected. Reason: ${body.reject_reason}`,
    });

    const syncResult = body.action === 'approve'
      ? await syncApprovedRequestToEr(supabaseAdmin, id)
      : null;

    if (body.action === 'approve') {
      await ensureTicketMessageThread(supabaseAdmin, id);
    }

    const { data: refreshedRequest } = await supabaseAdmin
      .from('service_requests')
      .select('id, request_number, verification_status, sync_status, er_ticket_id, sync_error, last_synced_at')
      .eq('id', id)
      .single();

    await pingChannel(NOTIFY_CHANNELS.verify);
    return NextResponse.json({
      request: refreshedRequest ?? data,
      sync: syncResult,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to review request.' },
      { status: 400 },
    );
  }
}
