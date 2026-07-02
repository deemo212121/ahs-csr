import type { SupabaseClient } from '@supabase/supabase-js';
import { localProfileId, type AuthContext } from '@/lib/auth/server';
import type { ServiceRequest } from '@/lib/types';
import { getErSupabaseAdmin, isErSupabaseConfigured } from '@/lib/supabase/er-admin';
import { ensureErCustomerLinksForProfile, getLinkedErCustomerIds, matchErCustomersToLocalProfiles } from '@/lib/er-customer-links';
import { listErModeRequests, useErTicketDatabase } from '@/lib/er-ticket-database';

export type TicketMessageRequest = {
  id: string;
  request_number: string;
  full_name: string;
  phone_number: string;
  customer_email: string | null;
  city: string | null;
  region: string | null;
  state: string | null;
  zip_code: string | null;
  manual_brand: string | null;
  manual_appliance_type: string | null;
  model_number: string | null;
  serial_number: string | null;
  issue_description: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  verification_status: string;
  er_ticket_id: string | null;
  requested_at: string;
  updated_at: string;
};

type LocalServiceRequest = TicketMessageRequest & {
  customer_id: string | null;
};

type TicketMessageThread = {
  id: string;
  request_id: string | null;
  customer_id: string | null;
  request_number: string;
  er_ticket_id: string | null;
  er_ticket_no: string | null;
  er_customer_id: string | null;
  source_system: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  service_address: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;
  service_region: string | null;
  manufacturer: string | null;
  product_type: string | null;
  model_number: string | null;
  serial_number: string | null;
  schedule_date: string | null;
  ticket_status: string | null;
  subject: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type TicketMessage = {
  id: string;
  thread_id: string;
  request_id: string | null;
  sender_profile_id: string | null;
  sender_role: string | null;
  sender_name: string;
  message_body: string;
  message_type: string;
  is_internal: boolean;
  created_at: string;
};

type LocalCustomerProfile = {
  id: string;
  email: string | null;
  phone_number: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ErCustomerRow = Record<string, unknown>;
type ErTicketRow = Record<string, unknown>;
type ErTicketAuditRow = {
  id: string | null;
  ticket_id: string | null;
  action: string | null;
  field: string | null;
  before_value: string | null;
  after_value: string | null;
  created_at: string | null;
};

type CustomerResolvableRequest = {
  customer_id?: string | null;
  customer_email?: string | null;
  phone_number?: string | null;
  secondary_phone?: string | null;
};

const requestSelect = 'id, customer_id, request_number, full_name, phone_number, customer_email, city, region, state, zip_code, manual_brand, manual_appliance_type, model_number, serial_number, issue_description, preferred_date, preferred_time, verification_status, er_ticket_id, requested_at, updated_at';
const threadSelect = [
  'id',
  'request_id',
  'customer_id',
  'request_number',
  'er_ticket_id',
  'er_ticket_no',
  'er_customer_id',
  'source_system',
  'customer_name',
  'customer_phone',
  'customer_email',
  'service_address',
  'service_city',
  'service_state',
  'service_zip',
  'service_region',
  'manufacturer',
  'product_type',
  'model_number',
  'serial_number',
  'schedule_date',
  'ticket_status',
  'subject',
  'status',
  'last_message_at',
  'created_at',
  'updated_at',
].join(', ');
const messageSelect = 'id, thread_id, request_id, sender_profile_id, sender_role, sender_name, message_body, message_type, is_internal, created_at';

const erTicketMessageColumns = [
  'id',
  'ticket_no',
  'customer_id',
  'ticket_source',
  'warranty',
  'manufacturer',
  'model',
  'model_version',
  'serial',
  'product_type',
  'purchase_date',
  'status',
  'schedule_date',
  'call_received_date',
  'internal_note',
  'created_at',
  'updated_at',
  'location',
  'technician',
  'time_slot',
  'problem_description',
].join(', ');

const erCustomerColumns = [
  'id',
  'full_name',
  'first_name',
  'last_name',
  'phone',
  'second_phone',
  'email',
  'address',
  'address2',
  'city',
  'state',
  'zip',
  'address_note',
].join(', ');

function displayName(profile: AuthContext['profile']) {
  return [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'User';
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function text(value: unknown, fallback = '') {
  return cleanString(value) ?? fallback;
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

function normalizePhone(value?: string | null) {
  const digits = value?.replace(/\D/g, '') || '';
  if (!digits) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function requestSubject(request: LocalServiceRequest) {
  const product = request.manual_appliance_type || 'Service Request';
  return `${request.request_number} • ${product}`;
}

function threadRequestFromThread(thread: TicketMessageThread): TicketMessageRequest {
  const createdAt = thread.created_at || new Date().toISOString();
  return {
    id: thread.request_id || thread.er_ticket_id || thread.id,
    request_number: thread.request_number,
    full_name: thread.customer_name || 'Customer',
    phone_number: thread.customer_phone || '',
    customer_email: thread.customer_email,
    city: thread.service_city,
    region: thread.service_region,
    state: thread.service_state,
    zip_code: thread.service_zip,
    manual_brand: thread.manufacturer,
    manual_appliance_type: thread.product_type,
    model_number: thread.model_number,
    serial_number: thread.serial_number,
    issue_description: null,
    preferred_date: thread.schedule_date,
    preferred_time: null,
    verification_status: 'approved',
    er_ticket_id: thread.er_ticket_id,
    requested_at: createdAt,
    updated_at: thread.updated_at || createdAt,
  };
}

function approvalMessage(request: LocalServiceRequest) {
  return `Hello ${request.full_name || 'Customer'}, your service request ${request.request_number} has been approved. You can reply here for schedule updates, address changes, appliance details, or questions about this ticket.`;
}

function erThreadMessage(thread: TicketMessageThread) {
  return `Conversation opened for ER ticket ${thread.er_ticket_no || thread.request_number}. You can use this chat for schedule updates, address changes, appliance details, or questions about this ticket.`;
}

function erCustomerName(row: ErCustomerRow | undefined) {
  if (!row) return null;
  const fullName = cleanString(row.full_name);
  if (fullName) return fullName;
  return [cleanString(row.first_name), cleanString(row.last_name)].filter(Boolean).join(' ').trim() || null;
}

function getErCustomersTable() {
  return process.env.ER_SUPABASE_CUSTOMERS_TABLE?.trim() || 'customers';
}

function getErTicketsTable() {
  return process.env.ER_SUPABASE_TICKETS_TABLE?.trim() || 'tickets';
}

function getErTicketAuditTable() {
  return process.env.ER_TICKET_AUDIT_LOG_TABLE?.trim() || 'ticket_audit_log';
}

function auditValue(value?: string | null) {
  return cleanString(value) || 'not set';
}

const CLOSED_TICKET_STATUSES = new Set([
  'cl-cancelled',
  'cl-claimed',
  'cl-data-closed',
  'cl-ready to complete',
  'cl-need cancel',
]);

function isClosedTicketStatus(status: string | null | undefined): boolean {
  return CLOSED_TICKET_STATUSES.has((status ?? '').trim().toLowerCase());
}

function auditFieldLabel(field?: string | null) {
  const normalized = (field || '').trim().toLowerCase();
  if (normalized === 'status') return 'status';
  if (normalized === 'schedule_date') return 'schedule date';
  if (normalized === 'time_slot') return 'time slot';
  if (normalized === 'technician') return 'technician';
  if (normalized === 'location') return 'branch/location';
  if (normalized === 'part_order') return 'part order';
  return normalized.replace(/_/g, ' ') || 'ticket detail';
}

function auditMessage(row: ErTicketAuditRow) {
  const field = auditFieldLabel(row.field);
  const beforeValue = auditValue(row.before_value);
  const afterValue = auditValue(row.after_value);
  const action = (row.action || '').trim().toLowerCase();

  if (field === 'status') {
    return `Ticket status update: ${beforeValue} → ${afterValue}.`;
  }

  if (field === 'schedule date' || action === 'reschedule') {
    return `Schedule update: ${beforeValue} → ${afterValue}.`;
  }

  return `Ticket update: ${field} changed from ${beforeValue} to ${afterValue}.`;
}

function mapErTicketToThreadInsert(ticket: ErTicketRow, customer: ErCustomerRow | undefined, localCustomerId: string | null) {
  const ticketNo = text(ticket.ticket_no, text(ticket.id));
  const customerName = erCustomerName(customer);
  const product = cleanString(ticket.product_type) || 'Service Request';
  const customerEmail = cleanString(customer?.email);
  const customerPhone = cleanString(customer?.phone) || cleanString(customer?.second_phone);
  const serviceAddress = [cleanString(customer?.address), cleanString(customer?.address2)].filter(Boolean).join(' ').trim() || null;

  return {
    request_id: null,
    customer_id: localCustomerId,
    request_number: ticketNo,
    er_ticket_id: text(ticket.id),
    er_ticket_no: ticketNo,
    er_customer_id: cleanString(ticket.customer_id),
    source_system: 'er_ticket_board',
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    service_address: serviceAddress,
    service_city: cleanString(ticket.location) || cleanString(customer?.city),
    service_state: cleanString(customer?.state),
    service_zip: cleanString(customer?.zip),
    service_region: cleanString(ticket.location),
    manufacturer: cleanString(ticket.manufacturer),
    product_type: cleanString(ticket.product_type),
    model_number: cleanString(ticket.model),
    serial_number: cleanString(ticket.serial),
    schedule_date: cleanString(ticket.schedule_date) || cleanString(ticket.call_received_date),
    ticket_status: cleanString(ticket.status),
    subject: `${ticketNo} • ${product}`,
    status: 'open',
    last_message_at: new Date().toISOString(),
  };
}

async function insertInitialApprovalMessage(
  supabaseAdmin: SupabaseClient,
  thread: TicketMessageThread,
  request: LocalServiceRequest,
) {
  const { count } = await supabaseAdmin
    .from('ticket_messages')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', thread.id);

  if ((count ?? 0) > 0) return;

  await supabaseAdmin.from('ticket_messages').insert({
    thread_id: thread.id,
    request_id: request.id,
    sender_profile_id: null,
    sender_role: null,
    sender_name: 'USHS Support',
    message_body: approvalMessage(request),
    message_type: 'system',
    is_internal: false,
  });
}

async function insertInitialErMessage(
  supabaseAdmin: SupabaseClient,
  thread: TicketMessageThread,
) {
  const { count } = await supabaseAdmin
    .from('ticket_messages')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', thread.id);

  if ((count ?? 0) > 0) return;

  await supabaseAdmin.from('ticket_messages').insert({
    thread_id: thread.id,
    request_id: null,
    sender_profile_id: null,
    sender_role: null,
    sender_name: 'USHS Support',
    message_body: erThreadMessage(thread),
    message_type: 'system',
    is_internal: false,
  });
}

async function syncErAuditMessages(
  supabaseAdmin: SupabaseClient,
  thread: TicketMessageThread,
  auditRows: ErTicketAuditRow[] | undefined,
) {
  if (!auditRows?.length) return;

  const { data: existingMessages } = await supabaseAdmin
    .from('ticket_messages')
    .select('id, message_body, created_at')
    .eq('thread_id', thread.id)
    .eq('message_type', 'ticket_update')
    .limit(1000);

  const existingKeys = new Set(
    ((existingMessages ?? []) as Array<{ message_body: string | null; created_at: string | null }>)
      .map((message) => `${message.created_at || ''}|${message.message_body || ''}`),
  );

  const payload = auditRows
    .filter((row) => row.created_at)
    .map((row) => ({
      row,
      body: auditMessage(row),
      createdAt: row.created_at as string,
    }))
    .filter((item) => !existingKeys.has(`${item.createdAt}|${item.body}`))
    .map((item) => ({
      thread_id: thread.id,
      request_id: thread.request_id,
      sender_profile_id: null,
      sender_role: null,
      sender_name: 'USHS Ticket Updates',
      message_body: item.body,
      message_type: 'ticket_update',
      is_internal: false,
      created_at: item.createdAt,
    }));

  if (!payload.length) return;

  const { error } = await supabaseAdmin.from('ticket_messages').insert(payload);
  if (error) return;

  const latest = payload[payload.length - 1]?.created_at;
  const latestStatus = [...auditRows]
    .reverse()
    .find((row) => (row.field || '').trim().toLowerCase() === 'status')?.after_value;
  const currentLastMessageAt = thread.last_message_at || thread.created_at;
  const currentTime = currentLastMessageAt ? new Date(currentLastMessageAt).getTime() : 0;
  const auditTime = latest ? new Date(latest).getTime() : 0;
  const nextLastMessageAt = auditTime > currentTime ? latest : currentLastMessageAt;

  await supabaseAdmin
    .from('ticket_message_threads')
    .update({
      last_message_at: nextLastMessageAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ticket_status: latestStatus || thread.ticket_status,
    })
    .eq('id', thread.id);
}

async function upsertLocalTicketErLink(
  supabaseAdmin: SupabaseClient,
  thread: TicketMessageThread,
) {
  if (!thread.customer_id || !thread.er_ticket_id) return;

  try {
    await supabaseAdmin
      .from('ticket_er_links')
      .upsert({
        local_customer_id: thread.customer_id,
        local_request_id: thread.request_id,
        er_ticket_id: thread.er_ticket_id,
        er_ticket_no: thread.er_ticket_no || thread.request_number,
        er_customer_id: thread.er_customer_id,
        link_type: thread.source_system === 'er_ticket_board' ? 'er_customer_match' : 'local_verified_request',
        linked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'local_customer_id,er_ticket_id' });
  } catch {
    // Optional local tracking table. If the setup SQL has not been run yet, messaging still works.
  }
}

export async function ensureTicketMessageThread(
  supabaseAdmin: SupabaseClient,
  requestId: string,
): Promise<TicketMessageThread | null> {
  const { data: request, error: requestError } = await supabaseAdmin
    .from('service_requests')
    .select(requestSelect)
    .eq('id', requestId)
    .eq('verification_status', 'approved')
    .maybeSingle();

  if (requestError) throw new Error(requestError.message);
  if (!request) return null;

  const localRequest = request as LocalServiceRequest;
  const customerId = await resolveLocalCustomerIdForRequest(supabaseAdmin, localRequest);
  if (!customerId) return null;

  const { data: byRequestId, error: existingError } = await supabaseAdmin
    .from('ticket_message_threads')
    .select(threadSelect)
    .eq('request_id', localRequest.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  // A ticket approved through the AHS/ER portal may already have a shared
  // thread created by ensureErPortalRequestMessageThread/ensureErTicketThreads
  // with request_id left null (those key off er_ticket_id instead). Looking
  // up by request_id alone missed that thread and created a second, brand
  // new "open" thread for the same ticket on every customer poll.
  let existing = byRequestId;
  if (!existing && localRequest.er_ticket_id) {
    const { data: byErTicketId, error: erLookupError } = await supabaseAdmin
      .from('ticket_message_threads')
      .select(threadSelect)
      .eq('er_ticket_id', localRequest.er_ticket_id)
      .maybeSingle();
    if (erLookupError) throw new Error(erLookupError.message);
    existing = byErTicketId;
  }

  if (existing) {
    let thread = existing as unknown as TicketMessageThread;
    const patch: Record<string, unknown> = {};
    if (thread.customer_id !== customerId) patch.customer_id = customerId;
    if (!thread.request_id) patch.request_id = localRequest.id;
    // Backfill service_region on threads created before that column existed.
    if (!thread.service_region && localRequest.region) patch.service_region = localRequest.region;
    if (Object.keys(patch).length) {
      await supabaseAdmin
        .from('ticket_message_threads')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', thread.id);
      thread = { ...thread, ...patch };
    }
    await insertInitialApprovalMessage(supabaseAdmin, thread, localRequest);
    await upsertLocalTicketErLink(supabaseAdmin, thread);
    return thread;
  }

  const now = new Date().toISOString();
  const { data: created, error: createError } = await supabaseAdmin
    .from('ticket_message_threads')
    .insert({
      request_id: localRequest.id,
      customer_id: customerId,
      request_number: localRequest.request_number,
      er_ticket_id: localRequest.er_ticket_id,
      er_ticket_no: localRequest.er_ticket_id,
      source_system: 'local_verified_ticket',
      customer_name: localRequest.full_name,
      customer_phone: localRequest.phone_number,
      customer_email: localRequest.customer_email,
      service_address: [localRequest.city, localRequest.state, localRequest.zip_code].filter(Boolean).join(', ') || null,
      service_city: localRequest.city,
      service_state: localRequest.state,
      service_zip: localRequest.zip_code,
      service_region: localRequest.region,
      manufacturer: localRequest.manual_brand,
      product_type: localRequest.manual_appliance_type,
      model_number: localRequest.model_number,
      serial_number: localRequest.serial_number,
      schedule_date: localRequest.preferred_date,
      ticket_status: 'approved',
      subject: requestSubject(localRequest),
      status: 'open',
      last_message_at: now,
    })
    .select(threadSelect)
    .single();

  if (createError) throw new Error(createError.message);
  await insertInitialApprovalMessage(supabaseAdmin, created as unknown as TicketMessageThread, localRequest);
  await upsertLocalTicketErLink(supabaseAdmin, created as unknown as TicketMessageThread);
  return created as unknown as TicketMessageThread;
}

export async function ensureErPortalRequestMessageThread(
  supabaseAdmin: SupabaseClient,
  request: ServiceRequest,
): Promise<TicketMessageThread | null> {
  if (request.verification_status !== 'approved') return null;
  const customerId = await resolveLocalCustomerIdForRequest(supabaseAdmin, request);
  if (!customerId) return null;

  // Look up by er_ticket_id alone (not scoped to customer_id or
  // source_system) — that matches ticket_message_threads_er_ticket_unique_idx,
  // the actual database constraint. A ticket that's already synced to the ER
  // board may already have a thread created by ensureErTicketThreads under a
  // different source_system; scoping this lookup any narrower than the real
  // constraint caused duplicate-insert collisions that broke the whole batch.
  const erTicketId = request.er_ticket_id || null;
  const { data: existing, error: existingError } = await (erTicketId
    ? supabaseAdmin.from('ticket_message_threads').select(threadSelect).eq('er_ticket_id', erTicketId).maybeSingle()
    : supabaseAdmin
        .from('ticket_message_threads')
        .select(threadSelect)
        .eq('source_system', 'er_portal_service_request')
        .eq('request_number', request.request_number)
        .maybeSingle());
  if (existingError) throw new Error(existingError.message);

  const ensureInitialMessage = async (thread: TicketMessageThread) => {
    const { count } = await supabaseAdmin
      .from('ticket_messages')
      .select('id', { count: 'exact', head: true })
      .eq('thread_id', thread.id);

    if ((count ?? 0) > 0) return;

    await supabaseAdmin.from('ticket_messages').insert({
      thread_id: thread.id,
      request_id: null,
      sender_profile_id: null,
      sender_role: null,
      sender_name: 'USHS Support',
      message_body: `Hello ${request.full_name || 'Customer'}, your service request ${request.request_number} has been approved. You can reply here for schedule updates, address changes, appliance details, or questions about this ticket.`,
      message_type: 'system',
      is_internal: false,
    });
  };

  if (existing) {
    let thread = existing as unknown as TicketMessageThread;
    const patch: Record<string, unknown> = {};
    if (thread.customer_id !== customerId) patch.customer_id = customerId;
    // Backfill service_region on threads created before that column existed
    // (previously the "region" shown on screen fell back to the street
    // address, e.g. showing "Suite 2" instead of an actual AHS branch).
    if (!thread.service_region && request.region) patch.service_region = request.region;
    if (Object.keys(patch).length) {
      await supabaseAdmin
        .from('ticket_message_threads')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', thread.id);
      thread = { ...thread, ...patch };
    }
    await ensureInitialMessage(thread);
    await upsertLocalTicketErLink(supabaseAdmin, thread);
    return thread;
  }

  const now = new Date().toISOString();
  const { data: created, error: createError } = await supabaseAdmin
    .from('ticket_message_threads')
    .insert({
      request_id: null,
      customer_id: customerId,
      request_number: request.request_number,
      er_ticket_id: erTicketId,
      er_ticket_no: request.request_number,
      er_customer_id: null,
      source_system: 'er_portal_service_request',
      customer_name: request.full_name,
      customer_phone: request.phone_number,
      customer_email: request.customer_email,
      service_address: [request.service_address, request.service_address_2].filter(Boolean).join(' ') || null,
      service_city: request.city,
      service_state: request.state,
      service_zip: request.zip_code,
      service_region: request.region,
      manufacturer: request.manual_brand,
      product_type: request.manual_appliance_type,
      model_number: request.model_number,
      serial_number: request.serial_number,
      schedule_date: request.preferred_date,
      ticket_status: 'approved',
      subject: `${request.request_number} • ${request.manual_appliance_type || 'Service Request'}`,
      status: 'open',
      last_message_at: now,
    })
    .select(threadSelect)
    .single();

  if (createError) {
    // Another request (e.g. ensureErTicketThreads running for the same ticket)
    // may have won the race and inserted first. Re-fetch instead of failing.
    if (createError.code === '23505' && erTicketId) {
      const { data: raced, error: racedError } = await supabaseAdmin
        .from('ticket_message_threads')
        .select(threadSelect)
        .eq('er_ticket_id', erTicketId)
        .maybeSingle();
      if (racedError) throw new Error(racedError.message);
      if (raced) {
        const thread = raced as unknown as TicketMessageThread;
        await ensureInitialMessage(thread);
        await upsertLocalTicketErLink(supabaseAdmin, thread);
        return thread;
      }
    }
    throw new Error(createError.message);
  }
  const thread = created as unknown as TicketMessageThread;
  await ensureInitialMessage(thread);
  await upsertLocalTicketErLink(supabaseAdmin, thread);
  return thread;
}

export async function ensureApprovedTicketThreads(
  supabaseAdmin: SupabaseClient,
  auth: AuthContext,
  limit = 120,
) {
  let query = supabaseAdmin
    .from('service_requests')
    .select(requestSelect)
    .eq('verification_status', 'approved')
    .not('customer_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (auth.role === 'customer') {
    query = query.eq('customer_id', auth.profile.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  for (const request of (data ?? []) as LocalServiceRequest[]) {
    await ensureTicketMessageThread(supabaseAdmin, request.id);
  }
}

async function getLocalCustomerProfiles(supabaseAdmin: SupabaseClient) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, phone_number, first_name, last_name')
    .eq('role', 'customer')
    .limit(10000);

  if (error) throw new Error(error.message);
  return (data ?? []) as LocalCustomerProfile[];
}

async function resolveLocalCustomerIdForRequest(
  supabaseAdmin: SupabaseClient,
  request: CustomerResolvableRequest,
) {
  if (request.customer_id) return request.customer_id;

  const requestEmail = normalizeEmail(cleanString(request.customer_email));
  const requestPhone = normalizePhone(cleanString(request.phone_number) || cleanString(request.secondary_phone));
  if (!requestEmail && !requestPhone) return null;

  const profiles = await getLocalCustomerProfiles(supabaseAdmin);
  const match = profiles.find((profile) => {
    const profileEmail = normalizeEmail(profile.email);
    const profilePhone = normalizePhone(profile.phone_number);
    return Boolean(
      (requestEmail && profileEmail === requestEmail) ||
      (requestPhone && profilePhone === requestPhone),
    );
  });

  return match?.id ?? null;
}

async function ensureErTicketThreads(
  supabaseAdmin: SupabaseClient,
  auth: AuthContext,
  limit = 150,
) {
  if (!isErSupabaseConfigured()) return;

  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase) return;

  const linkedCustomerIds = auth.role === 'customer'
    ? await getLinkedErCustomerIds(supabaseAdmin, auth.profile)
    : [];

  // A customer's own thread already records its er_ticket_id once linked —
  // sync status updates for those directly, not only via customer_er_links.
  // That table is only populated when staff's matching step runs (it's
  // skipped below for the customer role), so relying on it alone meant
  // "USHS Ticket Updates" system messages only ever synced while a CSR had
  // the Messages page open, leaving the customer's chat looking stale.
  let ownThreadErTicketIds: string[] = [];
  if (auth.role === 'customer') {
    const { data: ownThreads } = await supabaseAdmin
      .from('ticket_message_threads')
      .select('er_ticket_id')
      .eq('customer_id', auth.profile.id)
      .not('er_ticket_id', 'is', null);
    ownThreadErTicketIds = ((ownThreads ?? []) as Array<{ er_ticket_id: string | null }>)
      .map((t) => t.er_ticket_id)
      .filter((id): id is string => Boolean(id));
  }

  if (auth.role === 'customer' && !linkedCustomerIds.length && !ownThreadErTicketIds.length) {
    return;
  }

  const orderColumn = process.env.ER_TICKET_VIEW_ORDER_COLUMN?.trim() || 'created_at';
  let ticketQuery = erSupabase
    .from(getErTicketsTable())
    .select(erTicketMessageColumns)
    .order(orderColumn, { ascending: false })
    .limit(limit);

  if (process.env.ER_TICKET_VIEW_COMPANY_ID?.trim()) {
    ticketQuery = ticketQuery.eq('company_id', process.env.ER_TICKET_VIEW_COMPANY_ID.trim());
  }

  if (auth.role === 'customer') {
    if (ownThreadErTicketIds.length && linkedCustomerIds.length) {
      ticketQuery = ticketQuery.or(
        `customer_id.in.(${linkedCustomerIds.join(',')}),id.in.(${ownThreadErTicketIds.join(',')})`,
      );
    } else if (ownThreadErTicketIds.length) {
      ticketQuery = ticketQuery.in('id', ownThreadErTicketIds);
    } else {
      ticketQuery = ticketQuery.in('customer_id', linkedCustomerIds);
    }
  }

  const { data: tickets, error: ticketError } = await ticketQuery;
  if (ticketError) return;

  const ticketRows = (tickets ?? []) as unknown as ErTicketRow[];
  if (!ticketRows.length) return;

  const erCustomerIds = Array.from(new Set(
    ticketRows
      .map((ticket) => cleanString(ticket.customer_id))
      .filter((value): value is string => Boolean(value)),
  ));

  let erCustomersById = new Map<string, ErCustomerRow>();
  if (erCustomerIds.length) {
    const { data: erCustomers, error: customerError } = await erSupabase
      .from(getErCustomersTable())
      .select(erCustomerColumns)
      .in('id', erCustomerIds);

    if (!customerError && erCustomers) {
      erCustomersById = new Map(
        (erCustomers as unknown as ErCustomerRow[])
          .map((customer) => [text(customer.id), customer] as const)
          .filter(([id]) => Boolean(id)),
      );
    }
  }

  // Match each ER customer to a registered local account (phone/email first,
  // then name as a fallback) so conversations only open for tickets whose
  // customer actually has an account in our system. Matches persist to
  // customer_er_links, so they're inspectable directly in Supabase.
  const erCustomerToLocalId = auth.role === 'customer'
    ? new Map<string, string>()
    : await matchErCustomersToLocalProfiles(supabaseAdmin, Array.from(erCustomersById.values()));
  const ticketIds = ticketRows.map((ticket) => text(ticket.id)).filter(Boolean);
  const auditRowsByTicketId = new Map<string, ErTicketAuditRow[]>();

  if (ticketIds.length) {
    try {
      // Fetch newest-first so the row limit trims old history, not the
      // latest change — querying ascending-with-a-limit was cutting off the
      // most recent status update once a ticket built up enough audit rows,
      // which left ticket_status (and the "closed" lock/grace logic that
      // reads it) stuck on a stale value even after the status was reverted.
      const { data: auditRows, error: auditError } = await erSupabase
        .from(getErTicketAuditTable())
        .select('id, ticket_id, action, field, before_value, after_value, created_at')
        .in('ticket_id', ticketIds)
        .order('created_at', { ascending: false })
        .limit(Math.max(1000, ticketIds.length * 25));

      if (!auditError && auditRows) {
        for (const row of auditRows as unknown as ErTicketAuditRow[]) {
          const ticketId = cleanString(row.ticket_id);
          if (!ticketId) continue;
          const existing = auditRowsByTicketId.get(ticketId) ?? [];
          existing.push(row);
          auditRowsByTicketId.set(ticketId, existing);
        }
        // Rows came back newest-first per ticket; the rest of this function
        // expects chronological (oldest-first) order.
        for (const [ticketId, rows] of auditRowsByTicketId) {
          auditRowsByTicketId.set(ticketId, rows.slice().reverse());
        }
      }
    } catch {
      // Audit messages are best-effort. If the ER audit table is unavailable,
      // conversations still load and normal chat still works.
    }
  }

  // BATCH: single query for all existing threads for these tickets. Not
  // scoped to source_system='er_ticket_board' — ticket_message_threads_er_ticket_unique_idx
  // is unique on er_ticket_id alone, so a ticket approved through the portal
  // (source_system='er_portal_service_request') may already have a thread
  // here. Missing that caused duplicate-insert collisions that broke the
  // whole batch and silently dropped unrelated tickets from the list.
  const { data: existingThreadsData } = await supabaseAdmin
    .from('ticket_message_threads')
    .select(threadSelect)
    .in('er_ticket_id', ticketIds);

  const existingByErTicketId = new Map<string, TicketMessageThread>(
    ((existingThreadsData ?? []) as unknown as TicketMessageThread[])
      .filter((t) => t.er_ticket_id)
      .map((t) => [t.er_ticket_id!, t]),
  );

  // Existing conversations are never auto-closed by the ER ticket's status —
  // status changes still flow in as automatic chat updates (below), but
  // whether the conversation itself locks is now entirely a manual CSR
  // action (see the thread PATCH "complete" action), not tied to what
  // happens to the ticket on the ER side.
  const newInserts: ReturnType<typeof mapErTicketToThreadInsert>[] = [];
  const existingThreadsToProcess: Array<{ erTicketId: string; thread: TicketMessageThread }> = [];

  for (const ticket of ticketRows) {
    const erTicketId = text(ticket.id);
    if (!erTicketId) continue;

    const ticketClosed = isClosedTicketStatus(cleanString(ticket.status));
    const erCustomerId = cleanString(ticket.customer_id);
    const erCustomer = erCustomerId ? erCustomersById.get(erCustomerId) : undefined;
    const localCustomerId = auth.role === 'customer'
      ? auth.profile.id
      : (erCustomerId && erCustomerToLocalId.get(erCustomerId)) || null;

    const existing = existingByErTicketId.get(erTicketId);
    if (existing) {
      existingThreadsToProcess.push({ erTicketId, thread: existing });
    } else if (!ticketClosed && localCustomerId) {
      // Only open a conversation for tickets whose customer has a matching
      // registered account in our system (matched by phone/email above).
      // Do not open a new thread for a ticket that is already completed/closed.
      newInserts.push(mapErTicketToThreadInsert(ticket, erCustomer, localCustomerId));
    }
  }

  // Insert new threads one at a time (not batched) so a single er_ticket_id
  // collision — e.g. a race with the portal-approval path creating the same
  // ticket's thread concurrently — only skips that one ticket instead of
  // failing the whole batch insert and silently dropping every other ticket.
  const newThreads: TicketMessageThread[] = [];
  for (const insertRow of newInserts) {
    const { data: created, error: insertError } = await supabaseAdmin
      .from('ticket_message_threads')
      .insert(insertRow)
      .select(threadSelect)
      .single();
    if (insertError) {
      console.error(`ensureErTicketThreads: failed to insert thread for er_ticket_id ${insertRow.er_ticket_id}:`, insertError.message);
      continue;
    }
    newThreads.push(created as unknown as TicketMessageThread);
  }

  const allThreads = [
    ...existingThreadsToProcess.map((e) => e.thread),
    ...newThreads,
  ];
  const allThreadIds = allThreads.map((t) => t.id).filter(Boolean);
  if (!allThreadIds.length) return;

  // BATCH: check which threads already have at least one message
  const { data: threadIdsWithMsg } = await supabaseAdmin
    .from('ticket_messages')
    .select('thread_id')
    .in('thread_id', allThreadIds);
  const threadIdsWithMessages = new Set(
    ((threadIdsWithMsg ?? []) as Array<{ thread_id: string }>).map((m) => m.thread_id),
  );

  // BATCH: insert initial welcome messages for threads that have none
  const initialMessages = allThreads
    .filter((t) => !threadIdsWithMessages.has(t.id))
    .map((t) => ({
      thread_id: t.id,
      request_id: null,
      sender_profile_id: null,
      sender_role: null,
      sender_name: 'USHS Support',
      message_body: erThreadMessage(t),
      message_type: 'system',
      is_internal: false,
    }));

  if (initialMessages.length) {
    await supabaseAdmin.from('ticket_messages').insert(initialMessages);
  }

  // BATCH: fetch all existing audit messages for all threads at once
  const { data: existingAuditMsgs } = await supabaseAdmin
    .from('ticket_messages')
    .select('thread_id, message_body, created_at')
    .in('thread_id', allThreadIds)
    .eq('message_type', 'ticket_update');

  const existingAuditKeysByThread = new Map<string, Set<string>>();
  for (const m of (existingAuditMsgs ?? []) as Array<{ thread_id: string; message_body: string | null; created_at: string | null }>) {
    const set = existingAuditKeysByThread.get(m.thread_id) ?? new Set<string>();
    set.add(`${m.created_at ?? ''}|${m.message_body ?? ''}`);
    existingAuditKeysByThread.set(m.thread_id, set);
  }

  // BATCH: collect all new audit messages across all threads, then insert once
  const auditMessagesToInsert: Array<Record<string, unknown>> = [];
  const threadTimestampUpdates = new Map<string, { lastMessageAt: string; ticketStatus: string | null }>();

  // Threads whose ticket_status needs refreshing even though there's no new
  // audit message to insert this run (e.g. the status-change message was
  // already recorded on a previous run, but ticket_status itself was never
  // re-synced to it) — updated directly, no dependency on auditInsertError.
  const statusOnlyUpdates: Array<{ threadId: string; ticketStatus: string }> = [];

  for (const thread of allThreads) {
    if (!thread.er_ticket_id) continue;
    const auditRows = auditRowsByTicketId.get(thread.er_ticket_id);
    if (!auditRows?.length) continue;

    const existingKeys = existingAuditKeysByThread.get(thread.id) ?? new Set<string>();
    const newAudit = auditRows
      .filter((row) => row.created_at)
      .map((row) => ({ row, body: auditMessage(row) }))
      .filter((item) => !existingKeys.has(`${item.row.created_at}|${item.body}`))
      .map((item) => ({
        thread_id: thread.id,
        request_id: thread.request_id,
        sender_profile_id: null,
        sender_role: null,
        sender_name: 'USHS Ticket Updates',
        message_body: item.body,
        message_type: 'ticket_update',
        is_internal: false,
        created_at: item.row.created_at,
      }));

    // Always recompute the true latest status from the full (correctly
    // ordered) audit trail — not gated behind "is there a new message to
    // insert", otherwise a status that reverted after its change message was
    // already recorded would never get reflected on the thread again.
    const latestStatus = [...auditRows].reverse()
      .find((r) => (r.field || '').trim().toLowerCase() === 'status')?.after_value ?? null;

    if (!newAudit.length) {
      if (latestStatus && latestStatus !== thread.ticket_status) {
        statusOnlyUpdates.push({ threadId: thread.id, ticketStatus: latestStatus });
      }
      continue;
    }

    auditMessagesToInsert.push(...newAudit);

    const latestCreatedAt = newAudit[newAudit.length - 1].created_at as string;
    const currentLast = thread.last_message_at || thread.created_at;
    const auditTime = latestCreatedAt ? new Date(latestCreatedAt).getTime() : 0;
    const currentTime = currentLast ? new Date(currentLast).getTime() : 0;
    threadTimestampUpdates.set(thread.id, {
      lastMessageAt: auditTime > currentTime ? latestCreatedAt : (currentLast || new Date().toISOString()),
      ticketStatus: latestStatus,
    });
  }

  if (auditMessagesToInsert.length) {
    const { error: auditInsertError } = await supabaseAdmin.from('ticket_messages').insert(auditMessagesToInsert);
    if (!auditInsertError) {
      for (const [threadId, update] of threadTimestampUpdates) {
        await supabaseAdmin
          .from('ticket_message_threads')
          .update({
            last_message_at: update.lastMessageAt,
            updated_at: new Date().toISOString(),
            ticket_status: update.ticketStatus,
          })
          .eq('id', threadId);
      }
    }
  }

  for (const update of statusOnlyUpdates) {
    await supabaseAdmin
      .from('ticket_message_threads')
      .update({ ticket_status: update.ticketStatus, updated_at: new Date().toISOString() })
      .eq('id', update.threadId);
  }

  // BATCH: upsert ER links for all threads that have both a customer and an ER ticket
  const erLinksPayload = allThreads
    .filter((t) => t.customer_id && t.er_ticket_id)
    .map((t) => ({
      local_customer_id: t.customer_id,
      local_request_id: t.request_id,
      er_ticket_id: t.er_ticket_id,
      er_ticket_no: t.er_ticket_no || t.request_number,
      er_customer_id: t.er_customer_id,
      link_type: 'er_customer_match',
      linked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

  if (erLinksPayload.length) {
    try {
      await supabaseAdmin
        .from('ticket_er_links')
        .upsert(erLinksPayload, { onConflict: 'local_customer_id,er_ticket_id' });
    } catch {
      // Optional local tracking table.
    }
  }
}

export async function getThreadForAccess(
  supabaseAdmin: SupabaseClient,
  auth: AuthContext,
  threadId: string,
) {
  const { data: thread, error } = await supabaseAdmin
    .from('ticket_message_threads')
    .select(threadSelect)
    .eq('id', threadId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!thread) throw new Error('Message thread not found.');

  const messageThread = thread as unknown as TicketMessageThread;

  if (auth.role === 'customer' && messageThread.customer_id !== auth.profile.id) {
    throw new Error('You do not have access to this message thread.');
  }

  return messageThread;
}

// Threads normally get created the moment a ticket is approved (see the
// review route), but any ticket approved before that wiring existed — or
// where that call failed — would otherwise never get a conversation. This
// backfills the shared thread for every already-approved AHS portal ticket
// (request_number starts with "SRV") whenever staff load the Messages page.
// Uses the same function that creates the customer's own thread — staff
// read/reply to that exact conversation, there is no separate staff copy.
async function backfillErPortalRequestThreads(
  supabaseAdmin: SupabaseClient,
  auth: AuthContext,
  limit: number,
) {
  if (!useErTicketDatabase()) return;

  try {
    const requests = await listErModeRequests({
      context: auth,
      verificationStatusFilter: 'approved',
      view: null,
      limit: Math.min(Math.max(limit, 50), 500),
    });

    for (const request of requests) {
      try {
        await ensureErPortalRequestMessageThread(supabaseAdmin, request);
      } catch (err) {
        console.error(`backfillErPortalRequestThreads: failed for ${request.request_number}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    // Best-effort backfill — a failure here should not break the Messages page.
    console.error('backfillErPortalRequestThreads: failed to list approved requests:', err instanceof Error ? err.message : err);
  }
}

export async function listTicketMessageThreads(
  supabaseAdmin: SupabaseClient,
  auth: AuthContext,
  limit = 80,
) {
  // Local service_request threads are only relevant for the customer role.
  // Skipping for staff avoids wasted subrequests in ER-mode deployments.
  if (auth.role === 'customer') {
    await ensureApprovedTicketThreads(supabaseAdmin, auth);
  }
  if (auth.role !== 'customer') {
    await backfillErPortalRequestThreads(supabaseAdmin, auth, limit);
  }
  await ensureErTicketThreads(supabaseAdmin, auth, limit);

  // Conversations are retained for both the customer and staff regardless of
  // the underlying ticket's status — a thread only ever gets created for an
  // approved ticket in the first place, so its mere existence here is enough.
  // Not filtering on `status` (open/closed) or `ticket_status` (approved):
  // both get flipped automatically whenever the ER ticket's status changes
  // (see the audit-sync logic below), which was making conversations
  // disappear for everyone the moment staff updated the ticket in AHS/ER —
  // exactly the opposite of what a "retained" conversation should do.
  // isThreadLocked() in the UI still greys out composing once a thread is
  // actually closed; it just no longer disappears from the list.
  let query = supabaseAdmin
    .from('ticket_message_threads')
    .select(threadSelect)
    .order('last_message_at', { ascending: false })
    .limit(limit);

  if (auth.role === 'customer') {
    query = query.eq('customer_id', auth.profile.id);
  }

  const { data: threadsData, error } = await query;
  if (error) throw new Error(error.message);

  const threads = (threadsData ?? []) as unknown as TicketMessageThread[];
  const requestIds = threads.map((thread) => thread.request_id).filter((id): id is string => Boolean(id));
  const threadIds = threads.map((thread) => thread.id);

  const requestsById = new Map<string, TicketMessageRequest>();
  if (requestIds.length) {
    const { data: requests, error: requestError } = await supabaseAdmin
      .from('service_requests')
      .select(requestSelect)
      .in('id', requestIds);

    if (requestError) throw new Error(requestError.message);
    for (const request of (requests ?? []) as LocalServiceRequest[]) {
      requestsById.set(request.id, request);
    }
  }

  const latestByThread = new Map<string, TicketMessage>();
  if (threadIds.length) {
    const { data: messages, error: messageError } = await supabaseAdmin
      .from('ticket_messages')
      .select(messageSelect)
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false })
      .limit(Math.max(100, threadIds.length * 3));

    if (messageError) throw new Error(messageError.message);
    for (const message of (messages ?? []) as TicketMessage[]) {
      if (!latestByThread.has(message.thread_id)) latestByThread.set(message.thread_id, message);
    }
  }

  return threads.map((thread) => ({
    ...thread,
    request: thread.request_id ? requestsById.get(thread.request_id) ?? threadRequestFromThread(thread) : threadRequestFromThread(thread),
    latest_message: latestByThread.get(thread.id) ?? null,
  }));
}

export async function getThreadMessages(
  supabaseAdmin: SupabaseClient,
  auth: AuthContext,
  threadId: string,
) {
  const thread = await getThreadForAccess(supabaseAdmin, auth, threadId);

  const messagesPromise = supabaseAdmin
    .from('ticket_messages')
    .select(messageSelect)
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true });

  const requestPromise = thread.request_id
    ? supabaseAdmin.from('service_requests').select(requestSelect).eq('id', thread.request_id).maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [{ data: request, error: requestError }, { data: messages, error: messagesError }] = await Promise.all([
    requestPromise,
    messagesPromise,
  ]);

  if (requestError) throw new Error(requestError.message);
  if (messagesError) throw new Error(messagesError.message);

  return {
    thread: {
      ...thread,
      request: request ?? threadRequestFromThread(thread),
    },
    messages: (messages ?? []) as TicketMessage[],
  };
}

export async function createTicketMessage(
  supabaseAdmin: SupabaseClient,
  auth: AuthContext,
  threadId: string,
  messageBody: string,
) {
  const trimmed = messageBody.trim();
  if (!trimmed) throw new Error('Message cannot be empty.');

  const thread = await getThreadForAccess(supabaseAdmin, auth, threadId);

  // Locking is a manual CSR action (see completeTicketThread) — the ER
  // ticket's own status no longer closes the conversation on its own.
  if (thread.status === 'closed') {
    throw new Error('This conversation has been marked complete. Messaging is now closed.');
  }

  const now = new Date().toISOString();

  const { data: message, error } = await supabaseAdmin
    .from('ticket_messages')
    .insert({
      thread_id: thread.id,
      request_id: thread.request_id,
      // ER staff profiles live in a different database and cannot satisfy this
      // local table's profiles foreign key. Name and role still identify them.
      sender_profile_id: localProfileId(auth),
      sender_role: auth.role,
      sender_name: displayName(auth.profile),
      message_body: trimmed,
      message_type: 'user',
      is_internal: false,
    })
    .select(messageSelect)
    .single();

  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from('ticket_message_threads')
    .update({ last_message_at: now, updated_at: now })
    .eq('id', thread.id);

  return message as TicketMessage;
}

// Manually locks a conversation. This is the only way a thread closes now —
// the ER ticket's own status changes still flow in as automatic chat
// updates, but never lock messaging on their own.
export async function completeTicketThread(
  supabaseAdmin: SupabaseClient,
  auth: AuthContext,
  threadId: string,
) {
  if (auth.role === 'customer') {
    throw new Error('Only CSR staff can mark a conversation complete.');
  }

  const thread = await getThreadForAccess(supabaseAdmin, auth, threadId);
  if (thread.status === 'closed') return thread;

  const now = new Date().toISOString();

  await supabaseAdmin.from('ticket_messages').insert({
    thread_id: thread.id,
    request_id: thread.request_id,
    sender_profile_id: localProfileId(auth),
    sender_role: auth.role,
    sender_name: displayName(auth.profile),
    message_body: `${displayName(auth.profile)} marked this conversation as complete.`,
    message_type: 'system',
    is_internal: false,
  });

  const { data: updated, error } = await supabaseAdmin
    .from('ticket_message_threads')
    .update({ status: 'closed', last_message_at: now, updated_at: now })
    .eq('id', thread.id)
    .select(threadSelect)
    .single();

  if (error) throw new Error(error.message);
  return updated as unknown as TicketMessageThread;
}

// Reverses completeTicketThread — reopens messaging if a CSR closed it by mistake.
export async function reopenTicketThread(
  supabaseAdmin: SupabaseClient,
  auth: AuthContext,
  threadId: string,
) {
  if (auth.role === 'customer') {
    throw new Error('Only CSR staff can reopen a conversation.');
  }

  const thread = await getThreadForAccess(supabaseAdmin, auth, threadId);
  if (thread.status !== 'closed') return thread;

  const now = new Date().toISOString();

  await supabaseAdmin.from('ticket_messages').insert({
    thread_id: thread.id,
    request_id: thread.request_id,
    sender_profile_id: localProfileId(auth),
    sender_role: auth.role,
    sender_name: displayName(auth.profile),
    message_body: `${displayName(auth.profile)} reopened this conversation.`,
    message_type: 'system',
    is_internal: false,
  });

  const { data: updated, error } = await supabaseAdmin
    .from('ticket_message_threads')
    .update({ status: 'open', last_message_at: now, updated_at: now })
    .eq('id', thread.id)
    .select(threadSelect)
    .single();

  if (error) throw new Error(error.message);
  return updated as unknown as TicketMessageThread;
}
