import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { BRANCHES as STATIC_BRANCHES } from '@/lib/branches';

const branchSelect = 'id, name, sort_order, is_listed, created_at, updated_at';
const branchSelectNoListedFlag = 'id, name, sort_order, created_at, updated_at';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Branch name is required.'),
});

const patchSchema = z.union([
  z.object({ order: z.array(z.string().uuid()).min(1) }),
  z.object({ id: z.string().uuid(), is_listed: z.boolean() }),
]);

// Any staff role reads the branch list (it drives filters on Tickets, Calls,
// Messages, Verification, Notification Settings) — only admins manage it.
const staffRoles = ['csr', 'team_leader', 'csr_manager', 'admin'] as const;

// Falls back to the old hardcoded list if the table hasn't been created yet
// (supabase/branches_setup.sql) — matches this codebase's convention of
// never hard-failing a page just because an optional migration hasn't run.
//
// Two modes:
//  - default: only "listed" branches, in filter/sort order — this is what
//    every CSR/manager/etc. branch checklist actually reads.
//  - ?all=true (admin only): every branch regardless of listed state, for
//    the Filter Management page's Listed/Unlisted columns.
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    requireRole(context, [...staffRoles]);
    const wantsAll = new URL(request.url).searchParams.get('all') === 'true';
    if (wantsAll) requireRole(context, ['admin']);

    const supabase = getSupabaseAdmin();
    let query = supabase.from('branches').select(branchSelect).order('sort_order', { ascending: true });
    if (!wantsAll) query = query.eq('is_listed', true);

    let { data, error } = await query;

    // is_listed doesn't exist yet (branches_add_is_listed.sql not run) —
    // retry without it and treat every branch as listed, same as before
    // that column existed.
    if (error && error.message.toLowerCase().includes('is_listed')) {
      const retry = await supabase.from('branches').select(branchSelectNoListedFlag).order('sort_order', { ascending: true });
      data = (retry.data ?? []).map((row) => ({ ...row, is_listed: true }));
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({
        branches: STATIC_BRANCHES.map((name, index) => ({ id: name, name, sort_order: index, is_listed: true })),
        source: 'static_fallback',
      });
    }

    return NextResponse.json({ branches: data ?? [], source: 'branches_table' });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load branches.' },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    requireRole(context, ['admin']);

    const body = createSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('branches')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSortOrder = (existing?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('branches')
      .insert({ name: body.name, sort_order: nextSortOrder })
      .select(branchSelect)
      .single();

    if (error) {
      if (error.message.toLowerCase().includes('duplicate')) {
        throw new Error(`"${body.name}" already exists.`);
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ branch: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to add branch.' },
      { status: 400 },
    );
  }
}

// Two shapes:
//  - { order: string[] } — bulk reorder after a drag-and-drop within a
//    column; each id's sort_order becomes its index.
//  - { id, is_listed } — toggle a single branch between the Listed and
//    Unlisted columns on the Filter Management page. Unlisted branches stay
//    in the table (so they can be re-listed later) but disappear from every
//    CSR/manager/etc. branch checklist immediately, since the default GET
//    only returns is_listed = true rows.
export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    requireRole(context, ['admin']);

    const body = patchSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();

    if ('order' in body) {
      await Promise.all(
        body.order.map((id, index) =>
          supabase.from('branches').update({ sort_order: index, updated_at: new Date().toISOString() }).eq('id', id),
        ),
      );
    } else {
      const { error: toggleError } = await supabase
        .from('branches')
        .update({ is_listed: body.is_listed, updated_at: new Date().toISOString() })
        .eq('id', body.id);
      if (toggleError) throw new Error(toggleError.message);
    }

    const { data, error } = await supabase
      .from('branches')
      .select(branchSelect)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);
    return NextResponse.json({ branches: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to update branches.' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    requireRole(context, ['admin']);

    const id = z.string().uuid().parse(new URL(request.url).searchParams.get('id'));
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('branches').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to remove branch.' },
      { status: 400 },
    );
  }
}
