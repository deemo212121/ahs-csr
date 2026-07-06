import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { completeTicketThread, markThreadReadState, reopenTicketThread } from '@/lib/messages';
import { NOTIFY_CHANNELS, pingChannel } from '@/lib/notifications/broadcast';

const patchSchema = z.object({
  action: z.union([z.literal('complete'), z.literal('reopen'), z.literal('mark_read'), z.literal('mark_unread')]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    const auth = await getAuthContext(request);
    // complete/reopen are staff-only, enforced inside those functions
    // themselves — mark_read/mark_unread are available to either side of
    // the conversation.
    requireRole(auth, ['customer', 'csr', 'team_leader', 'csr_manager', 'admin']);

    const { threadId } = await context.params;
    const { action } = patchSchema.parse(await request.json());

    const supabaseAdmin = getSupabaseAdmin();
    const thread = action === 'complete'
      ? await completeTicketThread(supabaseAdmin, auth, threadId)
      : action === 'reopen'
        ? await reopenTicketThread(supabaseAdmin, auth, threadId)
        : await markThreadReadState(supabaseAdmin, auth, threadId, action === 'mark_read');
    await pingChannel(NOTIFY_CHANNELS.messages);
    return NextResponse.json({ thread });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to update message thread.' },
      { status: 400 },
    );
  }
}
