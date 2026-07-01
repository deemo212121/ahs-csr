import type { SupabaseClient } from '@supabase/supabase-js';
import { getErSupabaseAdmin, isErSupabaseConfigured } from '@/lib/supabase/er-admin';
import type { AuthContext } from '@/lib/auth/server';
import type { ServiceRequest } from '@/lib/types';
import { getLinkedErCustomerIds } from '@/lib/er-customer-links';
import { getErSupabaseForStaff } from '@/lib/supabase/er-authenticated';

export type CreatePortalRequestInput = {
  full_name: string;
  phone_number: string;
  secondary_phone?: string;
  customer_email?: string;
  ticket_source?: string;
  service_address: string;
  service_address_2?: string;
  city?: string;
  region?: string;
  state?: string;
  zip_code: string;
  landmark?: string;
  manual_brand?: string;
  manual_appliance_type?: string;
  model_number?: string;
  serial_number?: string;
  product_model_version?: string;
  issue_description?: string;
  special_request?: string;
  preferred_date?: string;
  preferred_time?: string;
  purchase_date?: string;
  warranty_type?: string;
};

export type ReviewPortalRequestInput = {
  action: 'approve' | 'reject';
  reject_reason?: string;
  notes?: string;
};

export type ErTicketSyncResult = {
  ok: boolean;
  mode: 'er_supabase_native' | 'not_configured';
  erTicketId: string | null;
  message: string;
};

type PortalTicketRequestRow = Record<string, unknown>;
type ErTicketRow = Record<string, unknown>;

const portalRequestColumns = [
  'id',
  'company_id',
  'portal_customer_profile_id',
  'request_number',
  'ticket_source',
  'source_system',
  'origin_type',
  'er_ticket_id',
  'er_ticket_no',
  'last_synced_at',
  'full_name',
  'phone_number',
  'secondary_phone',
  'customer_email',
  'service_address',
  'service_address_2',
  'city',
  'region',
  'state',
  'zip_code',
  'landmark',
  'manual_brand',
  'manual_appliance_type',
  'model_number',
  'serial_number',
  'product_model_version',
  'issue_description',
  'special_request',
  'preferred_date',
  'preferred_time',
  'purchase_date',
  'warranty_type',
  'verification_status',
  'verification_reject_reason',
  'verification_notes',
  'verification_reviewed_by',
  'verification_reviewed_at',
  'created_at',
  'updated_at',
].join(', ');

// Existing ER public.tickets columns only.
// Do not include portal_* columns here because the ER team did not approve adding them.
const erTicketColumns = [
  'id',
  'company_id',
  'ticket_no',
  'customer_id',
  'location_id',
  'assigned_tech_id',
  'ticket_source',
  'warranty',
  'manufacturer',
  'account',
  'claim_company',
  'model',
  'model_version',
  'serial',
  'product_type',
  'purchase_date',
  'status',
  'part_order',
  'flow_type',
  'stage',
  'diagnosed',
  'customer_pref',
  'redo',
  'type',
  'schedule_date',
  'call_received_date',
  'aging',
  'calls',
  'delay',
  'internal_note',
  'fake_ticket',
  'original_ticket_no',
  'status_changed_at',
  'status_changed_by',
  'created_at',
  'updated_at',
  'location',
  'technician',
  'time_slot',
  'problem_description',
].join(', ');

const erCustomerColumns = [
  'id',
  'company_id',
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

type ErCustomerRow = Record<string, unknown>;


type HandledTicketMeta = {
  handled: boolean;
  count: number;
  lastActivityAt: string | null;
  lastAction: string | null;
  lastField: string | null;
  lastBefore: string | null;
  lastAfter: string | null;
  source: string | null;
};

export function useErTicketDatabase() {
  // ER portal mode: customer-submitted requests are stored in a separate ER table
  // first, then approved requests are inserted into ER public.tickets.
  // This does not modify the existing ER tickets schema.
  const mode = process.env.TICKET_DATABASE_MODE?.trim();
  return mode === 'er_supabase' || mode === 'er_portal_table' || mode === 'er_portal_requests';
}

function getPortalRequestsTable() {
  return process.env.ER_PORTAL_REQUESTS_TABLE?.trim() || 'portal_service_requests';
}

function getErTicketsTable() {
  return process.env.ER_SUPABASE_TICKETS_TABLE || 'tickets';
}

function getErCustomersTable() {
  return process.env.ER_SUPABASE_CUSTOMERS_TABLE || 'customers';
}

function nullableEnv(name: string) {
  const raw = process.env[name];
  if (!raw) return null;
  const value = raw.trim().replace(/^['\"]|['\"]$/g, '');
  if (!value || value.toLowerCase() === 'null' || value.toLowerCase() === 'undefined') return null;
  return value;
}

function cleanUuidCandidate(value: unknown) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/^['\"]|['\"]$/g, '');
  if (!cleaned || cleaned.toLowerCase() === 'null' || cleaned.toLowerCase() === 'undefined') return null;
  return cleaned;
}

async function resolveMostCommonErTicketCompanyId(erSupabase: SupabaseClient) {
  // Read-only fallback: choose the most common company_id already used in ER tickets.
  const { data, error } = await erSupabase
    .from(getErTicketsTable())
    .select('company_id')
    .not('company_id', 'is', null)
    .limit(1000);

  if (error) return null;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ company_id?: string | null }>) {
    const id = cleanUuidCandidate(row.company_id);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

async function resolveActiveErCompanyId(erSupabase: SupabaseClient) {
  // Optional read-only fallback from ER public.companies. This does not change any ER data.
  const tableName = process.env.ER_COMPANIES_TABLE?.trim() || 'companies';
  const { data, error } = await erSupabase
    .from(tableName)
    .select('id, is_active')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return cleanUuidCandidate((data as Record<string, unknown>).id);
}

async function resolveErCompanyId(erSupabase: SupabaseClient, portalRow?: PortalTicketRequestRow | null) {
  const portalCompanyId = cleanUuidCandidate(portalRow?.company_id);
  if (portalCompanyId) {
    return { companyId: portalCompanyId, source: 'portal_service_requests.company_id' };
  }

  const explicitCompanyId = nullableEnv('ER_DEFAULT_COMPANY_ID') ?? nullableEnv('ER_TICKET_VIEW_COMPANY_ID');
  if (explicitCompanyId) {
    return { companyId: explicitCompanyId, source: 'ER_DEFAULT_COMPANY_ID' };
  }

  const activeCompanyId = await resolveActiveErCompanyId(erSupabase);
  if (activeCompanyId) {
    return { companyId: activeCompanyId, source: 'ER companies table active company' };
  }

  const ticketCompanyId = await resolveMostCommonErTicketCompanyId(erSupabase);
  if (ticketCompanyId) {
    return { companyId: ticketCompanyId, source: 'fallback from ER tickets' };
  }

  throw new Error('Missing company_id. Fill portal_service_requests.company_id, add ER_DEFAULT_COMPANY_ID to .env.local, or set an active company in ER companies.');
}

function requireErSupabase() {
  if (!isErSupabaseConfigured()) {
    throw new Error('ER Supabase is not configured. Add ER_SUPABASE_URL and ER_SUPABASE_SERVICE_ROLE_KEY to .env.local.');
  }

  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase) {
    throw new Error('Unable to create ER Supabase client.');
  }

  return erSupabase;
}

function requestNumber() {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `SRV-${stamp}-${suffix}`;
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function nullableText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function nullableDate(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function nullableNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function nullableBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  return null;
}

function customerFullName(row: ErCustomerRow | undefined) {
  if (!row) return null;
  const fullName = nullableText(row.full_name);
  if (fullName) return fullName;
  const name = [nullableText(row.first_name), nullableText(row.last_name)].filter(Boolean).join(' ').trim();
  return name || null;
}

function addCustomerFields(ticket: ErTicketRow, customer?: ErCustomerRow) {
  return {
    ...ticket,
    customer_name: customerFullName(customer),
    customer_phone: nullableText(customer?.phone),
    customer_second_phone: nullableText(customer?.second_phone),
    customer_email: nullableText(customer?.email),
    customer_address: nullableText(customer?.address),
    customer_address2: nullableText(customer?.address2),
    customer_city: nullableText(customer?.city),
    customer_state: nullableText(customer?.state),
    customer_zip: nullableText(customer?.zip),
    customer_address_note: nullableText(customer?.address_note),
  };
}

function syncStatus(value: unknown): ServiceRequest['sync_status'] {
  const allowed: ServiceRequest['sync_status'][] = ['local_only', 'pending_er_sync', 'synced_to_er', 'er_imported', 'sync_failed'];
  return allowed.includes(value as ServiceRequest['sync_status']) ? value as ServiceRequest['sync_status'] : 'local_only';
}

function verificationStatus(value: unknown): ServiceRequest['verification_status'] {
  if (value === 'approved' || value === 'rejected' || value === 'pending') return value;
  return 'approved';
}

function mapPortalRequest(row: PortalTicketRequestRow): ServiceRequest {
  const createdAt = text(row.created_at, new Date().toISOString());
  return {
    id: text(row.id),
    company_id: nullableText(row.company_id),
    customer_id: nullableText(row.portal_customer_profile_id),
    request_number: text(row.request_number),
    ticket_source: nullableText(row.ticket_source),
    source_system: text(row.source_system, 'er_portal_requests'),
    origin_type: text(row.origin_type, 'Customer Portal Verification'),
    er_ticket_id: nullableText(row.er_ticket_id) ?? nullableText(row.er_ticket_no),
    full_name: text(row.full_name),
    phone_number: text(row.phone_number),
    secondary_phone: nullableText(row.secondary_phone),
    customer_email: nullableText(row.customer_email),
    service_address: text(row.service_address),
    service_address_2: nullableText(row.service_address_2),
    city: nullableText(row.city),
    region: nullableText(row.region),
    state: nullableText(row.state),
    zip_code: text(row.zip_code),
    landmark: nullableText(row.landmark),
    manual_brand: nullableText(row.manual_brand),
    manual_appliance_type: nullableText(row.manual_appliance_type),
    model_number: nullableText(row.model_number),
    serial_number: nullableText(row.serial_number),
    product_model_version: nullableText(row.product_model_version),
    issue_description: nullableText(row.issue_description),
    special_request: nullableText(row.special_request),
    preferred_date: nullableText(row.preferred_date),
    preferred_time: nullableText(row.preferred_time),
    purchase_date: nullableText(row.purchase_date),
    warranty_type: nullableText(row.warranty_type),
    verification_status: verificationStatus(row.verification_status),
    verification_reject_reason: nullableText(row.verification_reject_reason),
    verification_notes: nullableText(row.verification_notes),
    verification_reviewed_by: nullableText(row.verification_reviewed_by),
    sync_status: nullableText(row.er_ticket_id) || nullableText(row.er_ticket_no)
      ? 'synced_to_er'
      : verificationStatus(row.verification_status) === 'approved'
        ? 'pending_er_sync'
        : 'local_only',
    sync_error: null,
    last_synced_at: nullableText(row.last_synced_at),
    requested_at: createdAt,
    updated_at: text(row.updated_at, createdAt),
  };
}

function mapErTicket(row: ErTicketRow, handledMeta?: HandledTicketMeta): ServiceRequest {
  const createdAt = text(row.created_at, new Date().toISOString());
  const ticketNo = text(row.ticket_no, text(row.id));
  const customerId = nullableText(row.customer_id);

  return {
    id: text(row.id),
    customer_id: customerId,
    request_number: ticketNo,
    ticket_source: nullableText(row.ticket_source) ?? 'ER Ticket',
    source_system: 'er_supabase_tickets',
    origin_type: 'ER Ticket Board',
    er_ticket_id: text(row.id),
    full_name: nullableText(row.customer_name) ?? (customerId ? `ER Customer ${customerId.slice(0, 8)}` : 'ER Ticket'),
    phone_number: text(row.customer_phone),
    secondary_phone: nullableText(row.customer_second_phone),
    customer_email: nullableText(row.customer_email),
    service_address: text(row.customer_address, text(row.location, '')),
    service_address_2: nullableText(row.customer_address2),
    city: nullableText(row.customer_city),
    region: nullableText(row.location),
    state: nullableText(row.customer_state),
    zip_code: text(row.customer_zip),
    landmark: nullableText(row.customer_address_note),
    manual_brand: nullableText(row.manufacturer),
    manual_appliance_type: nullableText(row.product_type),
    model_number: nullableText(row.model),
    serial_number: nullableText(row.serial),
    product_model_version: nullableText(row.model_version),
    issue_description: nullableText(row.problem_description),
    special_request: nullableText(row.internal_note),
    preferred_date: nullableText(row.schedule_date) ?? nullableText(row.call_received_date),
    preferred_time: nullableText(row.time_slot),
    purchase_date: nullableText(row.purchase_date),
    warranty_type: nullableText(row.warranty),
    verification_status: 'approved',
    verification_reject_reason: null,
    verification_notes: null,
    sync_status: 'er_imported',
    sync_error: null,
    last_synced_at: nullableText(row.updated_at),
    requested_at: createdAt,
    updated_at: text(row.updated_at, createdAt),
    job_status: {
      status_name: nullableText(row.status),
    },
    handled_by_current_user: handledMeta?.handled ?? false,
    handled_activity_count: handledMeta?.count ?? 0,
    handled_last_activity_at: handledMeta?.lastActivityAt ?? null,
    handled_last_action: handledMeta?.lastAction ?? null,
    handled_last_field: handledMeta?.lastField ?? null,
    handled_last_before: handledMeta?.lastBefore ?? null,
    handled_last_after: handledMeta?.lastAfter ?? null,
    handled_source: handledMeta?.source ?? null,
    er_ticket: {
      company_id: nullableText(row.company_id),
      ticket_no: nullableText(row.ticket_no),
      customer_id: nullableText(row.customer_id),
      location_id: nullableText(row.location_id),
      assigned_tech_id: nullableText(row.assigned_tech_id),
      ticket_source: nullableText(row.ticket_source),
      warranty: nullableText(row.warranty),
      manufacturer: nullableText(row.manufacturer),
      account: nullableText(row.account),
      claim_company: nullableText(row.claim_company),
      model: nullableText(row.model),
      model_version: nullableText(row.model_version),
      serial: nullableText(row.serial),
      product_type: nullableText(row.product_type),
      purchase_date: nullableText(row.purchase_date),
      status: nullableText(row.status),
      part_order: nullableText(row.part_order),
      flow_type: nullableText(row.flow_type),
      stage: nullableText(row.stage),
      diagnosed: nullableBoolean(row.diagnosed),
      customer_pref: nullableBoolean(row.customer_pref),
      redo: nullableBoolean(row.redo),
      type: nullableText(row.type),
      schedule_date: nullableText(row.schedule_date),
      call_received_date: nullableText(row.call_received_date),
      aging: nullableNumber(row.aging),
      calls: nullableNumber(row.calls),
      delay: nullableNumber(row.delay),
      internal_note: nullableText(row.internal_note),
      fake_ticket: nullableBoolean(row.fake_ticket),
      original_ticket_no: nullableText(row.original_ticket_no),
      status_changed_at: nullableText(row.status_changed_at),
      status_changed_by: nullableText(row.status_changed_by),
      created_at: nullableText(row.created_at),
      updated_at: nullableText(row.updated_at),
      location: nullableText(row.location),
      technician: nullableText(row.technician),
      time_slot: nullableText(row.time_slot),
      problem_description: nullableText(row.problem_description),
      customer_name: nullableText(row.customer_name),
      customer_phone: nullableText(row.customer_phone),
      customer_second_phone: nullableText(row.customer_second_phone),
      customer_email: nullableText(row.customer_email),
      customer_address: nullableText(row.customer_address),
      customer_address2: nullableText(row.customer_address2),
      customer_city: nullableText(row.customer_city),
      customer_state: nullableText(row.customer_state),
      customer_zip: nullableText(row.customer_zip),
      customer_address_note: nullableText(row.customer_address_note),
    },
  };
}


function normalizePhoneCandidates(...values: Array<unknown>) {
  const candidates = new Set<string>();

  for (const value of values) {
    const raw = nullableText(value);
    if (!raw) continue;

    candidates.add(raw.trim());

    const digits = raw.replace(/\D/g, '');
    if (digits) candidates.add(digits);

    // Some ER customer rows use US-style dashes. This keeps exact matching useful
    // without guessing country codes or changing the stored phone format.
    if (digits.length === 10) {
      candidates.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
    }
  }

  return Array.from(candidates).filter(Boolean).slice(0, 8);
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: fullName.trim(), lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

async function findExistingErCustomerId(
  erSupabase: SupabaseClient,
  portalRow: PortalTicketRequestRow,
  companyId: string,
) {
  const email = nullableText(portalRow.customer_email);
  const phoneCandidates = normalizePhoneCandidates(portalRow.phone_number, portalRow.secondary_phone);

  if (email) {
    const { data, error } = await erSupabase
      .from(getErCustomersTable())
      .select('id, company_id')
      .eq('company_id', companyId)
      .ilike('email', email)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`ER customer email lookup failed: ${error.message}`);
    const id = cleanUuidCandidate((data as Record<string, unknown> | null)?.id);
    if (id) return id;
  }

  for (const phone of phoneCandidates) {
    const { data, error } = await erSupabase
      .from(getErCustomersTable())
      .select('id, company_id')
      .eq('company_id', companyId)
      .eq('phone', phone)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`ER customer phone lookup failed: ${error.message}`);
    const id = cleanUuidCandidate((data as Record<string, unknown> | null)?.id);
    if (id) return id;

    const { data: secondPhoneData, error: secondPhoneError } = await erSupabase
      .from(getErCustomersTable())
      .select('id, company_id')
      .eq('company_id', companyId)
      .eq('second_phone', phone)
      .limit(1)
      .maybeSingle();

    if (secondPhoneError) throw new Error(`ER customer second phone lookup failed: ${secondPhoneError.message}`);
    const secondPhoneId = cleanUuidCandidate((secondPhoneData as Record<string, unknown> | null)?.id);
    if (secondPhoneId) return secondPhoneId;
  }

  return null;
}

async function createErCustomerFromPortalRequest(
  erSupabase: SupabaseClient,
  portalRow: PortalTicketRequestRow,
  companyId: string,
) {
  const fullName = text(portalRow.full_name, 'Portal Customer');
  const { firstName, lastName } = splitFullName(fullName);

  const customerPayload = {
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    phone: text(portalRow.phone_number),
    second_phone: nullableText(portalRow.secondary_phone),
    email: nullableText(portalRow.customer_email) ?? '',
    address: text(portalRow.service_address),
    address2: nullableText(portalRow.service_address_2),
    city: nullableText(portalRow.city),
    state: nullableText(portalRow.state),
    zip: nullableText(portalRow.zip_code),
    address_note: nullableText(portalRow.landmark),
  };

  const { data, error } = await erSupabase
    .from(getErCustomersTable())
    .insert(customerPayload)
    .select('id, company_id')
    .single();

  if (error) {
    throw new Error(`ER customer insert failed: ${error.message}. attempted company_id=${companyId}; customer=${fullName}`);
  }

  const customerId = cleanUuidCandidate((data as Record<string, unknown> | null)?.id);
  if (!customerId) throw new Error('ER customer insert succeeded but did not return a customer id.');

  return customerId;
}

async function resolveErCustomerIdForPortalRequest(
  erSupabase: SupabaseClient,
  portalRow: PortalTicketRequestRow,
  companyId: string,
) {
  const explicitCustomerId = cleanUuidCandidate(nullableEnv('ER_DEFAULT_CUSTOMER_ID'));
  if (explicitCustomerId) return { customerId: explicitCustomerId, source: 'ER_DEFAULT_CUSTOMER_ID' };

  const existingCustomerId = await findExistingErCustomerId(erSupabase, portalRow, companyId);
  if (existingCustomerId) return { customerId: existingCustomerId, source: 'existing ER customer match' };

  const createdCustomerId = await createErCustomerFromPortalRequest(erSupabase, portalRow, companyId);
  return { customerId: createdCustomerId, source: 'created ER customer' };
}

function buildErTicketInsertPayload(portalRow: PortalTicketRequestRow, customerId: string) {
  const ticketNo = text(portalRow.request_number) || requestNumber();

  return {
    ticket_no: ticketNo,
    customer_id: customerId,
    location_id: null,
    assigned_tech_id: null,
    ticket_source: nullableText(portalRow.ticket_source) || nullableEnv('ER_DEFAULT_TICKET_SOURCE') || 'Customer Portal',
    warranty: nullableText(portalRow.warranty_type) || nullableEnv('ER_DEFAULT_WARRANTY'),
    manufacturer: nullableText(portalRow.manual_brand),
    account: null,
    claim_company: null,
    model: nullableText(portalRow.model_number),
    model_version: nullableText(portalRow.product_model_version),
    serial: nullableText(portalRow.serial_number),
    product_type: nullableText(portalRow.manual_appliance_type),
    purchase_date: nullableDate(portalRow.purchase_date),
  };
}

async function postApprovedPortalRequestToErTicket(
  erSupabase: SupabaseClient,
  erStaffSupabase: SupabaseClient,
  requestId: string,
): Promise<ErTicketSyncResult> {
  const { data: portalRow, error: portalError } = await erSupabase
    .from(getPortalRequestsTable())
    .select(portalRequestColumns)
    .eq('id', requestId)
    .single();

  if (portalError || !portalRow) {
    throw new Error(portalError?.message ?? 'Portal request was not found.');
  }

  const portal = mapPortalRequest(portalRow as unknown as PortalTicketRequestRow);

  if (portal.verification_status !== 'approved') {
    throw new Error('Only approved portal requests can be posted into ER tickets.');
  }

  if (portal.er_ticket_id) {
    return {
      ok: true,
      mode: 'er_supabase_native',
      erTicketId: portal.er_ticket_id,
      message: `${portal.request_number} is already linked to an ER ticket.`,
    };
  }

  const ticketNo = text((portalRow as unknown as PortalTicketRequestRow).request_number) || portal.request_number;

  // If the ticket was inserted successfully before but portal_service_requests was not updated,
  // re-link instead of creating a duplicate ticket number.
  const { data: existingTicket, error: existingError } = await erStaffSupabase
    .from(getErTicketsTable())
    .select('id, ticket_no')
    .eq('ticket_no', ticketNo)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingTicket?.id) {
    const existingTicketId = text((existingTicket as Record<string, unknown>).id);
    const existingTicketNo = text((existingTicket as Record<string, unknown>).ticket_no, ticketNo);

    const { error: linkError } = await erSupabase
      .from(getPortalRequestsTable())
      .update({
        er_ticket_id: existingTicketId,
        er_ticket_no: existingTicketNo,
        last_synced_at: new Date().toISOString(),
        verification_notes: portal.verification_notes || `Request verified and linked to existing ER ticket ${existingTicketNo}.`,
      })
      .eq('id', requestId);

    if (linkError) throw new Error(linkError.message);

    return {
      ok: true,
      mode: 'er_supabase_native',
      erTicketId: existingTicketId,
      message: `${existingTicketNo} was already in ER tickets and is now linked to the portal request.`,
    };
  }

  const company = await resolveErCompanyId(erSupabase, portalRow as unknown as PortalTicketRequestRow);
  const customer = await resolveErCustomerIdForPortalRequest(erStaffSupabase, portalRow as unknown as PortalTicketRequestRow, company.companyId);
  const insertPayload = buildErTicketInsertPayload(
    portalRow as unknown as PortalTicketRequestRow,
    customer.customerId,
  );

  if (!insertPayload.ticket_no) {
    throw new Error('Missing ticket_no for ER tickets insert.');
  }

  if (!insertPayload.customer_id) {
    throw new Error('Missing customer_id for ER tickets insert. The ER ticket trigger requires a linked ER customer.');
  }

  const { data: insertedTicket, error: insertError } = await erStaffSupabase
    .from(getErTicketsTable())
    .insert(insertPayload)
    .select('id, ticket_no, company_id, customer_id')
    .single();

  if (insertError) {
    const failureNote = `ER ticket insert failed: ${insertError.message}. authenticated company_id=${company.companyId}; customer_id=${insertPayload.customer_id}; ticket_no=${insertPayload.ticket_no}`;
    await erSupabase
      .from(getPortalRequestsTable())
      .update({
        verification_notes: failureNote,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', requestId);
    throw new Error(failureNote);
  }

  const insertedTicketId = text((insertedTicket as Record<string, unknown>).id);
  const insertedTicketNo = text((insertedTicket as Record<string, unknown>).ticket_no, ticketNo);

  const { error: updateError } = await erSupabase
    .from(getPortalRequestsTable())
    .update({
      er_ticket_id: insertedTicketId,
      er_ticket_no: insertedTicketNo,
      last_synced_at: new Date().toISOString(),
      verification_notes: `Request verified and posted to ER tickets as ${insertedTicketNo}.`,
    })
    .eq('id', requestId);

  if (updateError) throw new Error(updateError.message);

  return {
    ok: true,
    mode: 'er_supabase_native',
    erTicketId: insertedTicketId,
    message: `${insertedTicketNo} was posted to ER tickets.`,
  };
}


function blankHandledMeta(): HandledTicketMeta {
  return {
    handled: false,
    count: 0,
    lastActivityAt: null,
    lastAction: null,
    lastField: null,
    lastBefore: null,
    lastAfter: null,
    source: null,
  };
}

function fallbackHandledMeta(row: ErTicketRow, actorId: string): HandledTicketMeta | null {
  if (nullableText(row.status_changed_by) !== actorId) return null;

  return {
    handled: true,
    count: 1,
    lastActivityAt: nullableText(row.status_changed_at) ?? nullableText(row.updated_at) ?? nullableText(row.created_at),
    lastAction: 'status_change',
    lastField: 'status',
    lastBefore: null,
    lastAfter: nullableText(row.status),
    source: 'tickets.status_changed_by',
  };
}

async function getHandledTicketAuditMeta(
  erSupabase: SupabaseClient,
  context: AuthContext,
): Promise<Map<string, HandledTicketMeta>> {
  if (context.role === 'customer') return new Map();

  const actorId = cleanUuidCandidate(context.profile.id);
  if (!actorId) return new Map();

  const auditTable = process.env.ER_TICKET_AUDIT_LOG_TABLE?.trim() || 'ticket_audit_log';
  let query = erSupabase
    .from(auditTable)
    .select('ticket_id, action, field, before_value, after_value, created_at')
    .eq('changed_by', actorId)
    .not('ticket_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (process.env.ER_TICKET_VIEW_COMPANY_ID?.trim()) {
    query = query.eq('company_id', process.env.ER_TICKET_VIEW_COMPANY_ID.trim());
  }

  const { data, error } = await query;
  if (error || !data) return new Map();

  const grouped = new Map<string, HandledTicketMeta>();
  for (const row of data as Array<Record<string, unknown>>) {
    const ticketId = nullableText(row.ticket_id);
    if (!ticketId) continue;

    const existing = grouped.get(ticketId) ?? blankHandledMeta();
    grouped.set(ticketId, {
      handled: true,
      count: existing.count + 1,
      lastActivityAt: existing.lastActivityAt ?? nullableText(row.created_at),
      lastAction: existing.lastAction ?? nullableText(row.action),
      lastField: existing.lastField ?? nullableText(row.field),
      lastBefore: existing.lastBefore ?? nullableText(row.before_value),
      lastAfter: existing.lastAfter ?? nullableText(row.after_value),
      source: existing.source ?? 'ticket_audit_log.changed_by',
    });
  }

  return grouped;
}

function mergeHandledMeta(auditMeta: HandledTicketMeta | undefined, fallbackMeta: HandledTicketMeta | null) {
  if (!auditMeta && !fallbackMeta) return undefined;
  if (auditMeta && !fallbackMeta) return auditMeta;
  if (!auditMeta && fallbackMeta) return fallbackMeta;

  const primary = auditMeta!;
  const fallback = fallbackMeta!;
  return {
    handled: true,
    count: Math.max(primary.count, 0) + Math.max(fallback.count, 0),
    lastActivityAt: primary.lastActivityAt ?? fallback.lastActivityAt,
    lastAction: primary.lastAction ?? fallback.lastAction,
    lastField: primary.lastField ?? fallback.lastField,
    lastBefore: primary.lastBefore ?? fallback.lastBefore,
    lastAfter: primary.lastAfter ?? fallback.lastAfter,
    source: primary.source ?? fallback.source,
  } satisfies HandledTicketMeta;
}

export async function listErTicketsViewOnly({
  context,
  limit,
}: {
  context: AuthContext;
  limit: number;
}) {
  const erSupabase = requireErSupabase();

  // Leadership/staff ticket pages should show the live ER tickets table.
  // Customer pages must not receive all ER tickets.
  if (context.role === 'customer') {
    return [];
  }

  const tableName = getErTicketsTable();
  const orderColumn = process.env.ER_TICKET_VIEW_ORDER_COLUMN?.trim() || 'created_at';

  let query = erSupabase
    .from(tableName)
    .select(erTicketColumns)
    .limit(limit);

  // By default, show all current rows in ER public.tickets.
  // Set ER_TICKET_VIEW_COMPANY_ID only if the ER team wants the portal view limited to one company.
  if (process.env.ER_TICKET_VIEW_COMPANY_ID?.trim()) {
    query = query.eq('company_id', process.env.ER_TICKET_VIEW_COMPANY_ID.trim());
  }

  query = query.order(orderColumn, { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const tickets = ((data ?? []) as unknown as ErTicketRow[]);
  const customerIds = Array.from(new Set(
    tickets
      .map((row) => nullableText(row.customer_id))
      .filter((id): id is string => Boolean(id)),
  ));

  let customersById = new Map<string, ErCustomerRow>();
  if (customerIds.length) {
    const { data: customers, error: customerError } = await erSupabase
      .from(getErCustomersTable())
      .select(erCustomerColumns)
      .in('id', customerIds);

    // If the ER customer table name/permissions are not available, keep the ticket list working
    // and fall back to customer_id instead of failing the whole page.
    if (!customerError && customers) {
      customersById = new Map(
        (customers as unknown as ErCustomerRow[])
          .map((customer) => [text(customer.id), customer] as const)
          .filter(([id]) => Boolean(id)),
      );
    }
  }

  const actorId = cleanUuidCandidate(context.profile.id);
  const auditHandledByTicketId = actorId ? await getHandledTicketAuditMeta(erSupabase, context) : new Map<string, HandledTicketMeta>();

  return tickets.map((row) => {
    const customerId = nullableText(row.customer_id);
    const customer = customerId ? customersById.get(customerId) : undefined;
    const ticketId = text(row.id);
    const handledMeta = actorId
      ? mergeHandledMeta(auditHandledByTicketId.get(ticketId), fallbackHandledMeta(row, actorId))
      : undefined;
    return mapErTicket(addCustomerFields(row, customer), handledMeta);
  });
}

export async function listCustomerLinkedErTickets({
  localSupabase,
  context,
  limit,
}: {
  localSupabase: SupabaseClient;
  context: AuthContext;
  limit: number;
}) {
  if (context.role !== 'customer' || !isErSupabaseConfigured()) return [] as ServiceRequest[];

  const linkedCustomerIds = await getLinkedErCustomerIds(localSupabase, context.profile);
  if (!linkedCustomerIds.length) return [] as ServiceRequest[];

  const erSupabase = requireErSupabase();
  const tableName = getErTicketsTable();
  const orderColumn = process.env.ER_TICKET_VIEW_ORDER_COLUMN?.trim() || 'created_at';

  let query = erSupabase
    .from(tableName)
    .select(erTicketColumns)
    .in('customer_id', linkedCustomerIds)
    .order(orderColumn, { ascending: false })
    .limit(limit);

  if (process.env.ER_TICKET_VIEW_COMPANY_ID?.trim()) {
    query = query.eq('company_id', process.env.ER_TICKET_VIEW_COMPANY_ID.trim());
  }

  const { data, error } = await query;
  if (error) return [] as ServiceRequest[];

  const tickets = (data ?? []) as unknown as ErTicketRow[];
  if (!tickets.length) return [] as ServiceRequest[];

  const customerIds = Array.from(new Set(
    tickets
      .map((row) => nullableText(row.customer_id))
      .filter((id): id is string => Boolean(id)),
  ));

  let customersById = new Map<string, ErCustomerRow>();
  if (customerIds.length) {
    const { data: customers, error: customerError } = await erSupabase
      .from(getErCustomersTable())
      .select(erCustomerColumns)
      .in('id', customerIds);

    if (!customerError && customers) {
      customersById = new Map(
        (customers as unknown as ErCustomerRow[])
          .map((customer) => [text(customer.id), customer] as const)
          .filter(([id]) => Boolean(id)),
      );
    }
  }

  return tickets.map((row) => {
    const customerId = nullableText(row.customer_id);
    const customer = customerId ? customersById.get(customerId) : undefined;
    return {
      ...mapErTicket(addCustomerFields(row, customer)),
      customer_id: context.profile.id,
    };
  });
}

export async function listErModeRequests({
  context,
  verificationStatusFilter,
  view,
  limit,
}: {
  context: AuthContext;
  verificationStatusFilter: string | null;
  view: string | null;
  limit: number;
}) {
  const erSupabase = requireErSupabase();

  if (view === 'tickets') {
    return listErTicketsViewOnly({ context, limit });
  }

  let query = erSupabase
    .from(getPortalRequestsTable())
    .select(portalRequestColumns)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (verificationStatusFilter) {
    query = query.eq('verification_status', verificationStatusFilter);
  }

  if (context.role === 'customer') {
    query = query.eq('portal_customer_profile_id', context.profile.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PortalTicketRequestRow[]).map((row) => mapPortalRequest(row));
}

export async function createErModePortalRequest(context: AuthContext, body: CreatePortalRequestInput) {
  const erSupabase = requireErSupabase();
  const isCustomer = context.role === 'customer';
  const erStaffSupabase = isCustomer ? null : await getErSupabaseForStaff(context);
  const company = await resolveErCompanyId(erSupabase);

  const { data, error } = await erSupabase
    .from(getPortalRequestsTable())
    .insert({
      company_id: company.companyId,
      portal_customer_profile_id: isCustomer ? context.profile.id : null,
      portal_customer_email: context.profile.email || null,
      request_number: requestNumber(),
      ticket_source: isCustomer ? body.ticket_source || 'Customer Portal' : 'Manual Ticket',
      source_system: isCustomer ? 'customer_portal' : 'csr_manual',
      origin_type: isCustomer ? 'Customer App' : 'Manual Ticket',
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
      manual_brand: body.manual_brand || null,
      manual_appliance_type: body.manual_appliance_type || null,
      model_number: body.model_number || null,
      serial_number: body.serial_number || null,
      product_model_version: body.product_model_version || null,
      issue_description: body.issue_description || null,
      special_request: body.special_request || null,
      preferred_date: body.preferred_date || null,
      preferred_time: body.preferred_time || null,
      purchase_date: body.purchase_date || null,
      warranty_type: body.warranty_type || null,
      verification_notes: `Created from portal. company_id source: ${company.source}.`,
    })
    .select(portalRequestColumns)
    .single();

  if (error) throw new Error(error.message);

  const mapped = mapPortalRequest(data as unknown as PortalTicketRequestRow);

  // Manual CSR tickets are approved immediately and posted into ER public.tickets.
  if (erStaffSupabase) {
    await postApprovedPortalRequestToErTicket(erSupabase, erStaffSupabase, mapped.id);
    const { data: refreshed } = await erSupabase
      .from(getPortalRequestsTable())
      .select(portalRequestColumns)
      .eq('id', mapped.id)
      .single();
    return refreshed ? mapPortalRequest(refreshed as unknown as PortalTicketRequestRow) : mapped;
  }

  return mapped;
}

export async function markApprovedPortalRequestPendingErPosting(
  erSupabase: SupabaseClient,
  context: AuthContext,
  requestId: string,
): Promise<ErTicketSyncResult> {
  // Kept for existing imports, but this now posts the approved portal request into ER public.tickets.
  const erStaffSupabase = await getErSupabaseForStaff(context);
  return postApprovedPortalRequestToErTicket(erSupabase, erStaffSupabase, requestId);
}

export async function reviewErModePortalRequest(
  context: AuthContext,
  requestId: string,
  body: ReviewPortalRequestInput,
) {
  const erSupabase = requireErSupabase();
  // Exchange/validate the real ER Firebase staff identity before changing an
  // approval row, so local/demo accounts cannot strand it in approved state.
  const erStaffSupabase = body.action === 'approve'
    ? await getErSupabaseForStaff(context)
    : null;
  const now = new Date().toISOString();

  const update = body.action === 'approve'
    ? {
        verification_status: 'approved',
        verification_reviewed_by: context.profile.id,
        verification_reviewed_at: now,
        verification_reject_reason: null,
        verification_notes: body.notes || 'Request verified and approved for ER ticket posting.',
        last_synced_at: null,
      }
    : {
        verification_status: 'rejected',
        verification_reviewed_by: context.profile.id,
        verification_reviewed_at: now,
        verification_reject_reason: body.reject_reason,
        verification_notes: body.notes || null,
        is_fake_ticket: true,
      };

  const { data, error } = await erSupabase
    .from(getPortalRequestsTable())
    .update(update)
    .eq('id', requestId)
    .eq('verification_status', 'pending')
    .select(portalRequestColumns)
    .single();

  if (error) throw new Error(error.message);

  const sync: ErTicketSyncResult | null = body.action === 'approve'
    ? await postApprovedPortalRequestToErTicket(erSupabase, erStaffSupabase!, requestId)
    : null;

  const { data: refreshed } = await erSupabase
    .from(getPortalRequestsTable())
    .select(portalRequestColumns)
    .eq('id', requestId)
    .single();

  return {
    request: refreshed ? mapPortalRequest(refreshed as unknown as PortalTicketRequestRow) : mapPortalRequest(data as unknown as PortalTicketRequestRow),
    sync,
  };
}

export async function retryErModeSync(context: AuthContext, requestId: string) {
  const erSupabase = requireErSupabase();
  const erStaffSupabase = await getErSupabaseForStaff(context);
  return postApprovedPortalRequestToErTicket(erSupabase, erStaffSupabase, requestId);
}
