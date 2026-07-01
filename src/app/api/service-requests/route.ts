import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, localProfileId, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createErModePortalRequest, listCustomerLinkedErTickets, listErModeRequests, listErTicketsViewOnly, useErTicketDatabase } from '@/lib/er-ticket-database';
import { isErSupabaseConfigured } from '@/lib/supabase/er-admin';
import { ensureErPortalRequestMessageThread, ensureTicketMessageThread } from '@/lib/messages';
import { NOTIFY_CHANNELS, pingChannel } from '@/lib/notifications/broadcast';

const createRequestSchema = z.object({
  request_number: z.string().optional(),
  fake_ticket: z.boolean().optional(),
  full_name: z.string().min(2),
  phone_number: z.string().min(5),
  secondary_phone: z.string().optional(),
  customer_email: z.string().email().optional().or(z.literal('')),
  ticket_source: z.string().optional(),
  service_address: z.string().min(3),
  service_address_2: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().min(3),
  landmark: z.string().optional(),
  manual_brand: z.string().optional(),
  manual_appliance_type: z.string().optional(),
  model_number: z.string().optional(),
  serial_number: z.string().optional(),
  product_model_version: z.string().optional(),
  issue_description: z.string().optional(),
  special_request: z.string().optional(),
  preferred_date: z.string().optional(),
  preferred_time: z.string().optional(),
  preferred_time_slot: z.string().optional(),
  purchase_date: z.string().optional(),
  warranty_type: z.string().optional(),
  urgency_level: z.string().optional(),
  call_received_date: z.string().optional(),
});

function requestNumber() {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `SRV-${stamp}-${suffix}`;
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    const url = new URL(request.url);
    const verification = url.searchParams.get('verification_status');
    const view = url.searchParams.get('view');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50), 1), 2000);
    if (useErTicketDatabase()) {
      const requests = await listErModeRequests({
        context,
        verificationStatusFilter: verification,
        view,
        limit,
      });

      // Customer portal in ER request mode: show the customer's ER portal requests
      // plus any existing live ER tickets matched to their local profile by phone/email.
      if (context.role === 'customer' && isErSupabaseConfigured()) {
        const supabaseAdmin = getSupabaseAdmin();
        const erRequests = await listCustomerLinkedErTickets({
          localSupabase: supabaseAdmin,
          context,
          limit,
        });
        const existingIds = new Set(
          requests
            .map((item) => item.er_ticket_id || item.request_number)
            .filter(Boolean)
            .map(String),
        );
        return NextResponse.json({
          requests: [
            ...requests,
            ...erRequests.filter((item) => !existingIds.has(String(item.er_ticket_id || item.request_number))),
          ],
        });
      }

      return NextResponse.json({ requests });
    }

    // Current safe flow: verification stays in this portal database,
    // but staff Ticket Request pages are view-only from the live ER public.tickets table.
    if (view === 'tickets' && isErSupabaseConfigured() && context.role !== 'customer') {
      const requests = await listErTicketsViewOnly({ context, limit });
      return NextResponse.json({ requests });
    }

    const supabaseAdmin = getSupabaseAdmin();

    let query = supabaseAdmin
      .from('service_requests')
      .select(
        'id, legacy_id, customer_id, request_number, ticket_source, source_system, origin_type, er_ticket_id, full_name, phone_number, secondary_phone, customer_email, service_address, service_address_2, city, region, state, zip_code, landmark, manual_brand, manual_appliance_type, model_number, serial_number, product_model_version, issue_description, special_request, preferred_date, preferred_time, purchase_date, warranty_type, job_status_id, verification_status, verification_reject_reason, verification_notes, verification_reviewed_by, sync_status, sync_error, last_synced_at, requested_at, updated_at, brand:brands(name, legacy_id), appliance_type:appliance_types(name, legacy_id), job_status:job_statuses(status_name, color_code, legacy_id)',
      )
      .order('requested_at', { ascending: false })
      .limit(limit);

    if (verification) {
      query = query.eq('verification_status', verification);
    } else if (view === 'tickets') {
      // Normal Ticket Request pages must not show customer-submitted tickets
      // until they have been approved in the Verification Queue.
      // Manual CSR tickets are created as approved, but the manual source checks
      // keep older/manual rows visible even if their verification field is blank.
      query = query.or('verification_status.eq.approved,ticket_source.eq.csr_manual,source_system.eq.php_csr');
    }

    if (context.role === 'customer') {
      query = query.eq('customer_id', context.profile.id);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let requests: any[] = data ?? [];

    // Customer portal: show local customer requests plus matched live ER tickets.
    // Matching is local/read-only and uses ER customers phone/email links saved in this portal DB.
    if (context.role === 'customer' && isErSupabaseConfigured()) {
      const erRequests = await listCustomerLinkedErTickets({
        localSupabase: supabaseAdmin,
        context,
        limit,
      });

      const localErIds = new Set(
        (requests as Array<Record<string, unknown>>)
          .map((item: Record<string, unknown>) => item.er_ticket_id)
          .filter(Boolean)
          .map(String),
      );

      requests = [
        ...requests,
        ...erRequests.filter((item) => item.er_ticket_id && !localErIds.has(item.er_ticket_id)),
      ];
    }

    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load requests.' },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    requireRole(context, ['customer', 'csr', 'team_leader', 'csr_manager', 'admin']);

    const body = createRequestSchema.parse(await request.json());

    if (useErTicketDatabase()) {
      const requestRecord = await createErModePortalRequest(context, body);
      if (context.role !== 'customer') {
        await ensureErPortalRequestMessageThread(getSupabaseAdmin(), requestRecord);
      }
      if (context.role === 'customer') await pingChannel(NOTIFY_CHANNELS.verify);
      return NextResponse.json({ request: requestRecord }, { status: 201 });
    }

    const isCustomer = context.role === 'customer';
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('service_requests')
      .insert({
        request_number: !isCustomer && body.request_number?.trim() ? body.request_number.trim() : requestNumber(),
        customer_id: isCustomer ? context.profile.id : null,
        created_by_profile_id: isCustomer ? null : localProfileId(context),
        ticket_source: isCustomer ? body.ticket_source || 'cx_online' : 'csr_manual',
        source_system: isCustomer ? 'php_cx' : 'php_csr',
        origin_type: isCustomer ? 'Customer App' : 'Manual Ticket',
        sync_status: 'local_only',
        verification_status: isCustomer ? 'pending' : 'approved',
        full_name: body.full_name,
        phone_number: body.phone_number,
        secondary_phone: body.secondary_phone || null,
        customer_email: body.customer_email || null,
        service_address: body.service_address,
        service_address_2: body.service_address_2 || null,
        city: body.city || null,
        region: body.region || null,
        state: body.state || null,
        zip_code: body.zip_code,
        landmark: body.landmark || null,
        urgency_level: body.urgency_level || null,
        manual_brand: body.manual_brand || null,
        manual_appliance_type: body.manual_appliance_type || null,
        model_number: body.model_number || null,
        serial_number: body.serial_number || null,
        product_model_version: body.product_model_version || null,
        issue_description: body.issue_description || null,
        special_request: body.special_request || null,
        preferred_date: body.preferred_date || null,
        preferred_time: body.preferred_time || null,
        preferred_time_slot: body.preferred_time_slot || null,
        purchase_date: body.purchase_date || null,
        warranty_type: body.warranty_type || null,
        call_received_date: body.call_received_date || null,
        is_fake_ticket: !isCustomer && body.fake_ticket === true,
      })
      .select('id, request_number, verification_status, sync_status, er_ticket_id')
      .single();

    if (error) throw new Error(error.message);

    if (!isCustomer) {
      await ensureTicketMessageThread(supabaseAdmin, data.id);
    } else {
      await pingChannel(NOTIFY_CHANNELS.verify);
    }

    return NextResponse.json({ request: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to create request.' },
      { status: 400 },
    );
  }
}
