import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, requireRole, type AuthContext } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

function staffProfileKey(context: AuthContext) {
  return `${context.profileSource}:${context.profile.id}`;
}

function displayName(context: AuthContext) {
  return [context.profile.first_name, context.profile.last_name].filter(Boolean).join(' ') || context.profile.email || 'Staff';
}

const postSchema = z.object({
  note: z.string().trim().min(1).max(1000),
});

// Multiple timestamped notes per call — each save adds a new row rather than
// overwriting a single field, and nothing already saved is ever deleted.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['csr', 'team_leader', 'csr_manager', 'admin']);

    const { id } = await context.params;
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('call_notes')
      .select('id, call_id, author_profile_id, author_name, note, created_at')
      .eq('call_id', id)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return NextResponse.json({ notes: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load call notes.' },
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
    requireRole(auth, ['csr', 'team_leader', 'csr_manager', 'admin']);

    const { id } = await context.params;
    const body = postSchema.parse(await request.json());
    const supabaseAdmin = getSupabaseAdmin();

    const { data: call, error: loadError } = await supabaseAdmin
      .from('rtc_calls')
      .select('id, status, accepted_by_profile_id')
      .eq('id', id)
      .single();

    if (loadError || !call) throw new Error(loadError?.message ?? 'Call was not found.');
    if (call.status !== 'completed') {
      throw new Error('Notes can only be added to a completed call.');
    }
    if (call.accepted_by_profile_id !== staffProfileKey(auth)) {
      throw new Error('Only the CSR who answered this call can add a note.');
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from('call_notes')
      .insert({
        call_id: id,
        author_profile_id: staffProfileKey(auth),
        author_name: displayName(auth),
        note: body.note,
      })
      .select('id, call_id, author_profile_id, author_name, note, created_at')
      .single();

    if (insertError) throw new Error(insertError.message);
    return NextResponse.json({ note: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to save note.' },
      { status: 400 },
    );
  }
}
