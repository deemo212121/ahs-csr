import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createTicketMessage, getThreadMessages } from '@/lib/messages';
import { NOTIFY_CHANNELS, pingChannel } from '@/lib/notifications/broadcast';

const messageSchema = z.object({
  message: z.string().min(1).max(4000),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['customer', 'csr', 'team_leader', 'csr_manager', 'admin']);

    const { threadId } = await context.params;
    const result = await getThreadMessages(getSupabaseAdmin(), auth, threadId);
    // Opening a thread is what actually marks it read server-side (see
    // getThreadMessages) — ping so the nav badge (a separate poll/broadcast
    // subscriber, not this page) reflects it immediately instead of waiting
    // up to 25s for its next fallback poll. Only on the real unread->read
    // transition, so background polling of an already-read open thread
    // doesn't ping every 4 seconds.
    if (result.justMarkedRead) await pingChannel(NOTIFY_CHANNELS.messages);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load message thread.' },
      { status: 400 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['customer', 'csr', 'team_leader', 'csr_manager', 'admin']);

    const { threadId } = await context.params;
    const body = messageSchema.parse(await request.json());
    const message = await createTicketMessage(getSupabaseAdmin(), auth, threadId, body.message);
    await pingChannel(NOTIFY_CHANNELS.messages);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to send message.' },
      { status: 400 },
    );
  }
}
