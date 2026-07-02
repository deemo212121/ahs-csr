import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { completeTicketThread, reopenTicketThread } from '@/lib/messages';
import { NOTIFY_CHANNELS, pingChannel } from '@/lib/notifications/broadcast';

const patchSchema = z.object({
  action: z.union([z.literal('complete'), z.literal('reopen')]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['csr', 'team_leader', 'csr_manager', 'admin']);

    const { threadId } = await context.params;
    const { action } = patchSchema.parse(await request.json());

    const thread = action === 'complete'
      ? await completeTicketThread(getSupabaseAdmin(), auth, threadId)
      : await reopenTicketThread(getSupabaseAdmin(), auth, threadId);
    await pingChannel(NOTIFY_CHANNELS.messages);
    return NextResponse.json({ thread });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to update message thread.' },
      { status: 400 },
    );
  }
}
