import type { SupabaseClient } from '@supabase/supabase-js';
import { localProfileId, type AuthContext } from '@/lib/auth/server';
import type { ServiceRequest } from '@/lib/types';
import { getErSupabaseAdmin, isErSupabaseConfigured } from '@/lib/supabase/er-admin';
import { ensureErCustomerLinksForProfile, getLinkedErCustomerIds } from '@/lib/er-customer-links';

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
    region: thread.service_address,
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
    service_city: cleanString(customer?.city),
    service_state: cleanString(customer?.state),
    service_zip: cleanString(customer?.zip),
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

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('ticket_message_threads')
    .select(threadSelect)
    .eq('request_id', localRequest.id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) {
    let thread = existing as unknown as TicketMessageThread;
    if (thread.customer_id !== customerId) {
      await supabaseAdmin
        .from('ticket_message_threads')
        .update({ customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('id', thread.id);
      thread = { ...thread, customer_id: customerId };
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

  const erTicketId = request.er_ticket_id || null;
  let existingQuery = supabaseAdmin
    .from('ticket_message_threads')
    .select(threadSelect)
    .eq('customer_id', customerId);

  if (erTicketId) {
    existingQuery = existingQuery.eq('er_ticket_id', erTicketId);
  } else {
    existingQuery = existingQuery
      .eq('source_system', 'er_portal_service_request')
      .eq('request_number', request.request_number);
  }

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
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
    if (thread.customer_id !== customerId) {
      await supabaseAdmin
        .from('ticket_message_threads')
        .update({ customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('id', thread.id);
      thread = { ...thread, customer_id: customerId };
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

  if (createError) throw new Error(createError.message);
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

function findMatchingLocalCustomer(
  profiles: LocalCustomerProfile[],
  customer: ErCustomerRow | undefined,
) {
  const erEmail = normalizeEmail(cleanString(customer?.email));
  const erPhone = normalizePhone(cleanString(customer?.phone) || cleanString(customer?.second_phone));

  if (!erEmail && !erPhone) return null;

  const match = profiles.find((profile) => {
    const profileEmail = normalizeEmail(profile.email);
    const profilePhone = normalizePhone(profile.phone_number);
    return Boolean((erEmail && profileEmail === erEmail) || (erPhone && profilePhone === erPhone));
  });

  return match?.id ?? null;
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

  if (auth.role === 'customer' && !linkedCustomerIds.length) {
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
    ticketQuery = ticketQuery.in('customer_id', linkedCustomerIds);
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

  const localProfiles = auth.role === 'customer' ? [] : await getLocalCustomerProfiles(supabaseAdmin);
  const localProfileIds = new Set(localProfiles.map((profile) => profile.id));
  const ticketIds = ticketRows
    .map((ticket) => text(ticket.id))
    .filter(Boolean);
  const auditRowsByTicketId = new Map<string, ErTicketAuditRow[]>();

  if (ticketIds.length) {
    try {
      const { data: auditRows, error: auditError } = await erSupabase
        .from(getErTicketAuditTable())
        .select('id, ticket_id, action, field, before_value, after_value, created_at')
        .in('ticket_id', ticketIds)
        .order('created_at', { ascending: true })
        .limit(Math.max(1000, ticketIds.length * 25));

      if (!auditError && auditRows) {
        for (const row of auditRows as unknown as ErTicketAuditRow[]) {
          const ticketId = cleanString(row.ticket_id);
          if (!ticketId) continue;
          const existing = auditRowsByTicketId.get(ticketId) ?? [];
          existing.push(row);
          auditRowsByTicketId.set(ticketId, existing);
        }
      }
    } catch {
      // Audit messages are best-effort. If the ER audit table is unavailable,
      // conversations still load and normal chat still works.
    }
  }

  for (const ticket of ticketRows) {
    const erTicketId = text(ticket.id);
    if (!erTicketId) continue;

    const erCustomerId = cleanString(ticket.customer_id);
    const erCustomer = erCustomerId ? erCustomersById.get(erCustomerId) : undefined;
    const localCustomerId = auth.role === 'customer'
      ? auth.profile.id
      : findMatchingLocalCustomer(localProfiles, erCustomer);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('ticket_message_threads')
      .select(threadSelect)
      .eq('er_ticket_id', erTicketId)
      .maybeSingle();

    if (existingError) continue;

    if (existing) {
      const existingThread = existing as unknown as TicketMessageThread;
      const needsCustomerLink = localCustomerId && existingThread.customer_id !== localCustomerId;
      const existingCustomerStillValid = existingThread.customer_id ? localProfileIds.has(existingThread.customer_id) || existingThread.customer_id === auth.profile.id : true;
      if (needsCustomerLink || !existingCustomerStillValid) {
        await supabaseAdmin
          .from('ticket_message_threads')
          .update({
            customer_id: localCustomerId,
            er_customer_id: erCustomerId,
            customer_name: erCustomerName(erCustomer),
            customer_phone: cleanString(erCustomer?.phone) || cleanString(erCustomer?.second_phone),
            customer_email: cleanString(erCustomer?.email),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingThread.id);
      }
      await insertInitialErMessage(supabaseAdmin, existingThread);
      await syncErAuditMessages(supabaseAdmin, existingThread, auditRowsByTicketId.get(erTicketId));
      await upsertLocalTicketErLink(supabaseAdmin, existingThread);
      continue;
    }

    const insertPayload = mapErTicketToThreadInsert(ticket, erCustomer, localCustomerId);
    const { data: created, error: createError } = await supabaseAdmin
      .from('ticket_message_threads')
      .insert(insertPayload)
      .select(threadSelect)
      .single();

    if (!createError && created) {
      const thread = created as unknown as TicketMessageThread;
      await insertInitialErMessage(supabaseAdmin, thread);
      await syncErAuditMessages(supabaseAdmin, thread, auditRowsByTicketId.get(erTicketId));
      await upsertLocalTicketErLink(supabaseAdmin, thread);
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

export async function listTicketMessageThreads(
  supabaseAdmin: SupabaseClient,
  auth: AuthContext,
  limit = 80,
) {
  await ensureApprovedTicketThreads(supabaseAdmin, auth);
  await ensureErTicketThreads(supabaseAdmin, auth, limit);

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
