import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isErSupabaseConfigured } from '@/lib/supabase/er-admin';
import { listErModeRequests, useErTicketDatabase } from '@/lib/er-ticket-database';
import { ensureErPortalRequestMessageThread, listTicketMessageThreads } from '@/lib/messages';

// Staff-only self-serve diagnostics for "why is the Messages page empty?" —
// walks the exact same path a customer-submitted (SRV) ticket takes to
// become a staff-visible conversation, and reports counts/errors at each
// stage instead of failing silently.
export async function GET(request: NextRequest) {
  const steps: Record<string, unknown> = {};

  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['csr', 'team_leader', 'csr_manager', 'admin']);

    steps.er_mode_active = useErTicketDatabase();
    steps.er_supabase_configured = isErSupabaseConfigured();

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Can we read the local ticket_message_threads table at all?
    const threadsProbe = await supabaseAdmin.from('ticket_message_threads').select('id').limit(1);
    steps.local_ticket_message_threads_table = threadsProbe.error
      ? { ok: false, error: threadsProbe.error.message }
      : { ok: true };
    if (threadsProbe.error) {
      steps.blocker = `Cannot read ticket_message_threads: ${threadsProbe.error.message}. Run supabase/customer_ticket_messages_setup.sql on your MAIN app Supabase.`;
      return NextResponse.json({ steps });
    }

    if (!useErTicketDatabase()) {
      steps.blocker = 'useErTicketDatabase() is false in this environment, so the portal-request flow being tested here does not apply. Ticket data is coming from the local service_requests table instead.';
      return NextResponse.json({ steps });
    }

    // 2. Pull approved portal requests (the SRV tickets) the same way the
    // Messages page's backfill does.
    let approvedRequests: Awaited<ReturnType<typeof listErModeRequests>>;
    try {
      approvedRequests = await listErModeRequests({
        context: auth,
        verificationStatusFilter: 'approved',
        view: null,
        limit: 50,
      });
    } catch (err) {
      steps.blocker = `listErModeRequests(approved) threw: ${err instanceof Error ? err.message : String(err)}`;
      return NextResponse.json({ steps });
    }

    steps.approved_portal_requests = {
      count: approvedRequests.length,
      sample: approvedRequests.slice(0, 10).map((r) => ({
        request_number: r.request_number,
        customer_id: r.customer_id,
        full_name: r.full_name,
        er_ticket_id: r.er_ticket_id,
      })),
    };

    if (!approvedRequests.length) {
      steps.blocker = 'listErModeRequests found 0 requests with verification_status=approved. Either nothing is approved yet, or this staff account cannot see them (check branch/company scoping).';
      return NextResponse.json({ steps });
    }

    const withoutCustomerId = approvedRequests.filter((r) => !r.customer_id);
    steps.approved_requests_missing_customer_id = withoutCustomerId.length;

    // 3. Actually run thread creation/backfill for each approved request and
    // report exactly what happened.
    const results: Array<{ request_number: string; ok: boolean; thread_id?: string; error?: string }> = [];
    for (const r of approvedRequests) {
      try {
        const thread = await ensureErPortalRequestMessageThread(supabaseAdmin, r);
        results.push({ request_number: r.request_number, ok: !!thread, thread_id: thread?.id, error: thread ? undefined : 'returned null (see resolveLocalCustomerIdForRequest — likely no customer_id and no phone/email match)' });
      } catch (err) {
        results.push({ request_number: r.request_number, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    steps.thread_creation_results = results;
    steps.thread_creation_success_count = results.filter((r) => r.ok).length;

    // 4. Run the exact query the Messages page uses and report what it gets back.
    const finalThreads = await listTicketMessageThreads(supabaseAdmin, auth, 80);
    steps.final_staff_visible_thread_count = finalThreads.length;
    steps.final_staff_visible_sample = finalThreads.slice(0, 10).map((t) => ({
      request_number: t.request_number,
      source_system: t.source_system,
      customer_id: t.customer_id,
      service_city: t.service_city,
    }));

    if (!finalThreads.length && steps.thread_creation_success_count) {
      steps.blocker = 'Threads were created successfully, but listTicketMessageThreads still returns 0. This points at the branch_access filter (for csr/team_leader) excluding every thread\'s service_city — check your profile.branch_access value against the service_city values above.';
    } else if (!steps.thread_creation_success_count) {
      steps.blocker = 'Every thread-creation attempt failed or returned null — see thread_creation_results for the specific reason per ticket.';
    } else {
      steps.blocker = null;
    }

    return NextResponse.json({ steps });
  } catch (error) {
    return NextResponse.json(
      { steps, message: error instanceof Error ? error.message : 'Diagnostics failed unexpectedly.' },
      { status: 400 },
    );
  }
}
