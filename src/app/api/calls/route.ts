import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getErSupabaseAdmin, isErSupabaseConfigured } from '@/lib/supabase/er-admin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { RtcCall, RtcCallStatus } from '@/lib/calls/types';
import { NOTIFY_CHANNELS, pingChannel } from '@/lib/notifications/broadcast';
import { sendPushToProfiles } from '@/lib/push/send';
import { mapCallRow, nullableText, text } from '@/lib/calls/mapCallRow';

const openCallStatuses: RtcCallStatus[] = ['manager_queue', 'assigned', 'accepted'];

const callSelect = `
  id,
  request_id,
  customer_id,
  company_id,
  customer_name,
  customer_email,
  phone_number,
  notes,
  call_reason,
  branch,
  city,
  state,
  zip_code,
  status,
  queued_at,
  accepted_at,
  call_started_at,
  call_ended_at,
  call_duration_seconds,
  accepted_by_profile_id,
  accepted_by_name,
  accepted_by_role,
  staff_joined_at,
  customer_joined_at,
  last_staff_seen_at,
  last_customer_seen_at,
  ended_by_profile_id,
  ended_reason,
  recording_path,
  recording_mime,
  recording_uploaded_at,
  created_at,
  request:service_requests(id, request_number)
`;

const requestSelect = 'id, request_number, full_name, phone_number, customer_email, city, region, state, zip_code, issue_description, requested_at';

const createCallSchema = z.object({
  request_id: z.string().uuid().optional(),
  phone_number: z.string().min(5).optional(),
  call_reason: z.string().max(160).optional(),
  notes: z.string().max(1000).optional(),
  branch: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
  zip_code: z.string().max(20).optional(),
});

type ServiceRequestHint = {
  id: string;
  request_number: string;
  full_name: string;
  phone_number: string;
  customer_email: string | null;
  city: string | null;
  region: string | null;
  state: string | null;
  zip_code: string | null;
  issue_description: string | null;
  requested_at: string;
};

function staffProfileKey(context: { profileSource: string; profile: { id: string } }) {
  return `${context.profileSource}:${context.profile.id}`;
}

function normalizeZip(value: unknown) {
  return text(value).replace(/\D/g, '').slice(0, 5);
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


function getErCoverageCompanyId() {
  return (
    process.env.ER_LOCATION_VIEW_COMPANY_ID?.trim() ||
    process.env.ER_TICKET_VIEW_COMPANY_ID?.trim() ||
    process.env.ER_DEFAULT_COMPANY_ID?.trim() ||
    ''
  );
}

async function resolveBranchFromZip(zipCode: string, city?: string | null) {
  const zip = normalizeZip(zipCode);
  if (!zip) return null;

  if (isErSupabaseConfigured()) {
    const erSupabase = getErSupabaseAdmin();
    if (erSupabase) {
      let query = erSupabase
        .from(process.env.ER_LOCATION_COVERAGE_TABLE?.trim() || 'location_mgmt_coverage')
        .select('location, city, self_schedule')
        .eq('zip_code', zip)
        .limit(8);

      const companyId = getErCoverageCompanyId();
      if (companyId) query = query.eq('company_id', companyId);

      const { data, error } = await query;
      if (!error && data?.length) {
        const normalizedCity = text(city).toLowerCase();
        const activeRows = data.filter((row) => text(row.self_schedule) !== '0');
        const candidates = activeRows.length ? activeRows : data;
        const cityMatch = normalizedCity
          ? candidates.find((row) => text(row.city).toLowerCase() === normalizedCity)
          : null;
        const branch = nullableText(cityMatch?.location || candidates[0]?.location);
        if (branch) return branch;
      }
    }
  }

  const { data } = await getSupabaseAdmin()
    .from('service_areas')
    .select('region, city, is_active')
    .eq('zip_code', zip)
    .limit(8);

  if (data?.length) {
    const normalizedCity = text(city).toLowerCase();
    const activeRows = data.filter((row) => row.is_active !== false);
    const candidates = activeRows.length ? activeRows : data;
    const cityMatch = normalizedCity
      ? candidates.find((row) => text(row.city).toLowerCase() === normalizedCity)
      : null;
    return nullableText(cityMatch?.region || candidates[0]?.region);
  }

  return null;
}

async function getRequestHint(customerId: string, requestId?: string) {
  let query = getSupabaseAdmin()
    .from('service_requests')
    .select(requestSelect)
    .eq('customer_id', customerId)
    .order('requested_at', { ascending: false })
    .limit(1);

  if (requestId) query = query.eq('id', requestId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data?.[0] ?? null) as ServiceRequestHint | null;
}

async function listBranchesFromCalls(calls: RtcCall[]) {
  const branches = new Set<string>();
  calls.forEach((call) => {
    if (call.branch) branches.add(call.branch);
  });

  try {
    const { data } = await getSupabaseAdmin()
      .from('rtc_calls')
      .select('branch')
      .not('branch', 'is', null)
      .order('branch', { ascending: true })
      .limit(500);

    data?.forEach((row) => {
      const branch = text(row.branch);
      if (branch) branches.add(branch);
    });
  } catch {
    // Branch filters can still render from the currently loaded calls.
  }

  return Array.from(branches).sort((a, b) => a.localeCompare(b));
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    requireRole(context, ['customer', 'csr', 'team_leader', 'csr_manager', 'admin']);

    const url = new URL(request.url);
    const history = url.searchParams.get('history') === 'true';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 80), 1), 250);
    const status = url.searchParams.get('status') as RtcCallStatus | null;
    const supabaseAdmin = getSupabaseAdmin();

    let query = supabaseAdmin
      .from('rtc_calls')
      .select(callSelect)
      .order('queued_at', { ascending: false })
      .limit(limit);

    if (context.profile.company_id) {
      query = query.eq('company_id', context.profile.company_id);
    }

    if (context.role === 'customer') {
      query = query.eq('customer_id', context.profile.id);
    } else if (status) {
      query = query.eq('status', status);
    } else if (!history) {
      query = query.in('status', openCallStatuses);
    }

    // Call history access is scoped by role: CSR agents only see their own
    // personal history (same calls counted in their "Web calls handled"
    // dashboard stat) — not the rest of the team's. Team leaders see their
    // own calls plus their team's — "team" means real team membership
    // (csr_team_assignments), not branch coverage, since a team leader's
    // branch_access can span branches with CSRs who aren't actually on
    // their team. CSR managers/admins see everything.
    if (history && context.role === 'csr') {
      query = query.eq('accepted_by_profile_id', staffProfileKey(context));
    }

    if (history && context.role === 'team_leader') {
      const { data: teamRows } = await supabaseAdmin
        .from('csr_team_assignments')
        .select('csr_staff_id')
        .eq('team_leader_staff_id', context.profile.id);
      const memberKeys = ((teamRows ?? []) as Array<{ csr_staff_id: string }>).map(
        (row) => `er:${row.csr_staff_id}`,
      );
      query = query.in('accepted_by_profile_id', [staffProfileKey(context), ...memberKeys]);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const calls = (data ?? []).map(mapCallRow);
    return NextResponse.json({ calls, branches: await listBranchesFromCalls(calls) });
  } catch (error) {
    const setupMessage = missingCallSchemaMessage(error);
    if (setupMessage) {
      return NextResponse.json({ calls: [], branches: [], setup_required: true, message: setupMessage });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load call queue.' },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    requireRole(context, ['customer']);

    const body = createCallSchema.parse(await request.json().catch(() => ({})));
    const supabaseAdmin = getSupabaseAdmin();

    const existing = await supabaseAdmin
      .from('rtc_calls')
      .select(callSelect)
      .eq('customer_id', context.profile.id)
      .in('status', openCallStatuses)
      .order('queued_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      return NextResponse.json({ call: mapCallRow(existing.data), reused: true });
    }

    const requestHint = await getRequestHint(context.profile.id, body.request_id);
    if (body.request_id && !requestHint) {
      throw new Error('That service request was not found on your customer account.');
    }
    const customerName =
      [context.profile.first_name, context.profile.last_name].filter(Boolean).join(' ') ||
      requestHint?.full_name ||
      context.profile.email ||
      'Customer';
    const phoneNumber =
      text(body.phone_number) ||
      text(context.profile.phone_number) ||
      text(requestHint?.phone_number) ||
      null;

    const zipCode = normalizeZip(body.zip_code || context.profile.zip_code || requestHint?.zip_code);
    const city = nullableText(body.city || context.profile.city || requestHint?.city);
    const state = nullableText(body.state || context.profile.state || requestHint?.state);
    const branch =
      nullableText(body.branch) ||
      nullableText(requestHint?.region) ||
      (await resolveBranchFromZip(zipCode, city)) ||
      nullableText(context.profile.region);

    const { data, error } = await supabaseAdmin
      .from('rtc_calls')
      .insert({
        request_id: requestHint?.id ?? body.request_id ?? null,
        customer_id: context.profile.id,
        company_id: context.profile.company_id,
        customer_name: customerName,
        customer_email: context.profile.email || requestHint?.customer_email || null,
        phone_number: phoneNumber,
        notes: body.notes || null,
        call_reason: body.call_reason || requestHint?.issue_description || 'Customer requested a live web call.',
        branch,
        city,
        state,
        zip_code: zipCode || null,
        status: 'manager_queue',
        queued_at: new Date().toISOString(),
      })
      .select(callSelect)
      .single();

    if (error) throw new Error(error.message);
    await pingChannel(NOTIFY_CHANNELS.calls);

    try {
      const companyId = context.profile.company_id;
      if (companyId && isErSupabaseConfigured()) {
        const erSupabase = getErSupabaseAdmin();
        if (erSupabase) {
          const table = process.env.ER_PROFILES_TABLE?.trim() || 'profiles';
          const { data: staff } = await erSupabase
            .from(table)
            .select('id')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .limit(200);
          const staffProfiles = ((staff ?? []) as Array<{ id: string }>).map((row) => ({ id: row.id, source: 'er' as const }));
          if (staffProfiles.length) {
            await sendPushToProfiles(supabaseAdmin, staffProfiles, {
              title: 'Incoming call',
              body: `${customerName} is requesting a call.`,
              url: '/csr/calls',
            });
          }
        }
      }
    } catch {
      // Best-effort — never block the call request over a failed push.
    }

    return NextResponse.json({ call: mapCallRow(data), reused: false }, { status: 201 });
  } catch (error) {
    const setupMessage = missingCallSchemaMessage(error);
    return NextResponse.json(
      { message: setupMessage || (error instanceof Error ? error.message : 'Unable to request a call.') },
      { status: 400 },
    );
  }
}
