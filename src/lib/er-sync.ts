import type { SupabaseClient } from '@supabase/supabase-js';
import { getErSupabaseAdmin, isErSupabaseConfigured } from '@/lib/supabase/er-admin';

type SyncMode = 'api' | 'supabase' | 'not_configured';

type SyncResult = {
  ok: boolean;
  mode: SyncMode;
  erTicketId: string | null;
  message: string;
};

type LocalServiceRequest = {
  id: string;
  request_number: string;
  ticket_source?: string | null;
  source_system?: string | null;
  origin_type?: string | null;
  full_name: string;
  phone_number: string;
  secondary_phone?: string | null;
  customer_email?: string | null;
  service_address: string;
  service_address_2?: string | null;
  city?: string | null;
  region?: string | null;
  state?: string | null;
  zip_code: string;
  landmark?: string | null;
  manual_brand?: string | null;
  manual_appliance_type?: string | null;
  model_number?: string | null;
  serial_number?: string | null;
  product_model_version?: string | null;
  issue_description?: string | null;
  special_request?: string | null;
  preferred_date?: string | null;
  preferred_time?: string | null;
  purchase_date?: string | null;
  warranty_type?: string | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  verification_reviewed_by?: string | null;
  verification_reviewed_at?: string | null;
  requested_at: string;
  updated_at: string;
};

const requestSelect = [
  'id',
  'request_number',
  'ticket_source',
  'source_system',
  'origin_type',
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
  'verification_reviewed_by',
  'verification_reviewed_at',
  'requested_at',
  'updated_at',
].join(', ');

function dateOnly(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function nullableEnv(name: string) {
  const raw = process.env[name];
  if (!raw) return null;

  const value = raw.trim().replace(/^['\"]|['\"]$/g, '');
  if (!value || value.toLowerCase() === 'null' || value.toLowerCase() === 'undefined') return null;
  return value;
}

async function resolveErCompanyId(erSupabase: SupabaseClient, tableName: string) {
  const explicitCompanyId = nullableEnv('ER_DEFAULT_COMPANY_ID') ?? nullableEnv('ER_TICKET_VIEW_COMPANY_ID');

  if (explicitCompanyId) {
    return { companyId: explicitCompanyId, source: 'ER_DEFAULT_COMPANY_ID' };
  }

  // Safety fallback: if the env var is missing or not being read, use the most common
  // existing company_id from the ER tickets table. This only reads ER data; it does not
  // modify any ER rows. It prevents approved portal tickets from being rejected with
  // "company_id violates not-null constraint" when the ER has one main company.
  const { data, error } = await erSupabase
    .from(tableName)
    .select('company_id')
    .not('company_id', 'is', null)
    .limit(1000);

  if (error) {
    throw new Error(`Missing ER_DEFAULT_COMPANY_ID in .env.local, and unable to read fallback company_id from ER tickets: ${error.message}`);
  }

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ company_id?: string | null }>) {
    const id = typeof row.company_id === 'string' ? row.company_id.trim() : '';
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (!top?.[0]) {
    throw new Error('Missing ER_DEFAULT_COMPANY_ID in .env.local, and no fallback company_id was found in the ER tickets table.');
  }

  return { companyId: top[0], source: 'fallback from existing ER tickets' };
}

function buildErPayload(ticket: LocalServiceRequest) {
  return {
    portal_request_id: ticket.id,
    portal_request_number: ticket.request_number,
    source_system: 'customer_portal',
    ticket_status: 'new',
    customer_name: ticket.full_name,
    phone_number: ticket.phone_number,
    secondary_phone: ticket.secondary_phone ?? null,
    customer_email: ticket.customer_email ?? null,
    service_address: ticket.service_address,
    service_address_2: ticket.service_address_2 ?? null,
    city: ticket.city ?? null,
    region: ticket.region ?? null,
    state: ticket.state ?? null,
    zip_code: ticket.zip_code,
    landmark: ticket.landmark ?? null,
    appliance_type: ticket.manual_appliance_type ?? null,
    brand: ticket.manual_brand ?? null,
    model_number: ticket.model_number ?? null,
    serial_number: ticket.serial_number ?? null,
    product_model_version: ticket.product_model_version ?? null,
    issue_description: ticket.issue_description ?? null,
    special_request: ticket.special_request ?? null,
    preferred_date: ticket.preferred_date ?? null,
    preferred_time: ticket.preferred_time ?? null,
    purchase_date: ticket.purchase_date ?? null,
    warranty_type: ticket.warranty_type ?? null,
    verification_status: ticket.verification_status,
    verified_at: ticket.verification_reviewed_at ?? new Date().toISOString(),
    sync_payload: ticket,
  };
}

function buildExistingErTicketPayload(ticket: LocalServiceRequest, companyId: string) {
  // Safe ER insert: do not update existing tickets and do not touch ER workflow/status fields.
  // Based on the ER tickets export, this only fills fields from ticket_no through purchase_date
  // plus company_id because company_id is required. customer_id is nullable and may be left null.
  return {
    company_id: companyId,
    ticket_no: ticket.request_number,
    customer_id: nullableEnv('ER_DEFAULT_CUSTOMER_ID'),
    location_id: null,
    assigned_tech_id: null,
    ticket_source: process.env.ER_DEFAULT_TICKET_SOURCE?.trim() || 'Customer Portal',
    warranty: ticket.warranty_type || process.env.ER_DEFAULT_WARRANTY?.trim() || null,
    manufacturer: ticket.manual_brand || null,
    account: null,
    claim_company: null,
    model: ticket.model_number || null,
    model_version: ticket.product_model_version || null,
    serial: ticket.serial_number || null,
    product_type: ticket.manual_appliance_type || null,
    purchase_date: dateOnly(ticket.purchase_date),
  };
}

function readErTicketId(data: Record<string, unknown> | null) {
  if (!data) return null;

  const value =
    data.er_ticket_id ??
    data.ticket_id ??
    data.request_id ??
    data.id ??
    null;

  return value ? String(value) : null;
}

async function syncViaApi(ticket: LocalServiceRequest): Promise<SyncResult> {
  const apiUrl = process.env.ER_SYNC_API_URL?.trim();
  if (!apiUrl) {
    return {
      ok: false,
      mode: 'not_configured',
      erTicketId: null,
      message: 'ER API sync is not configured.',
    };
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.ER_SYNC_API_KEY?.trim()
        ? { Authorization: `Bearer ${process.env.ER_SYNC_API_KEY.trim()}` }
        : {}),
    },
    body: JSON.stringify({
      event: 'ticket_verified',
      ticket: buildErPayload(ticket),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`ER API sync failed: ${response.status} ${details}`);
  }

  const responseJson = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const nestedRequest = responseJson?.request && typeof responseJson.request === 'object'
    ? responseJson.request as Record<string, unknown>
    : null;
  const erTicketId = readErTicketId(responseJson) ?? readErTicketId(nestedRequest);

  return {
    ok: true,
    mode: 'api',
    erTicketId,
    message: 'Ticket synced to ER API.',
  };
}

async function syncViaSupabase(ticket: LocalServiceRequest): Promise<SyncResult> {
  if (!isErSupabaseConfigured()) {
    return {
      ok: false,
      mode: 'not_configured',
      erTicketId: null,
      message: 'ER Supabase sync is not configured.',
    };
  }

  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase) {
    return {
      ok: false,
      mode: 'not_configured',
      erTicketId: null,
      message: 'ER Supabase sync is not configured.',
    };
  }

  // Current safe setup: verification stays in this website database.
  // Only approved requests are inserted into the ER project's existing public.tickets table.
  // Do not add portal-specific columns to ER tickets; use only existing ER ticket fields.
  const tableName = nullableEnv('ER_SUPABASE_TICKETS_TABLE') || 'tickets';
  const company = await resolveErCompanyId(erSupabase, tableName);
  const payload = buildExistingErTicketPayload(ticket, company.companyId);

  const { data, error } = await erSupabase
    .from(tableName)
    .insert(payload)
    .select('id, ticket_no')
    .single();

  if (error) {
    const code = (error as { code?: string }).code;
    const message = error.message || '';

    // If a retry happens after the ER insert succeeded but before local sync state was saved,
    // avoid creating another ER ticket. Match by the local request_number/ticket_no.
    if (code === '23505' || message.toLowerCase().includes('duplicate')) {
      const { data: existing, error: lookupError } = await erSupabase
        .from(tableName)
        .select('id, ticket_no')
        .eq('ticket_no', ticket.request_number)
        .maybeSingle();

      if (lookupError) {
        throw new Error(`ER Supabase sync failed after duplicate lookup: ${lookupError.message}`);
      }

      if (existing) {
        return {
          ok: true,
          mode: 'supabase',
          erTicketId: readErTicketId(existing as Record<string, unknown> | null),
          message: `Ticket already exists in ER Supabase table ${tableName}; local record was linked to the existing ER ticket.`,
        };
      }
    }

    throw new Error(`ER Supabase sync failed: ${error.message}`);
  }

  return {
    ok: true,
    mode: 'supabase',
    erTicketId: readErTicketId(data as Record<string, unknown> | null),
    message: `Approved ticket inserted into ER Supabase table: ${tableName}. company_id source: ${company.source}.`,
  };
}

async function updateLocalSyncState(
  localSupabase: SupabaseClient,
  requestId: string,
  result: Pick<SyncResult, 'erTicketId' | 'message'> & { syncStatus: 'pending_er_sync' | 'synced_to_er' | 'sync_failed' },
) {
  await localSupabase
    .from('service_requests')
    .update({
      er_ticket_id: result.erTicketId,
      sync_status: result.syncStatus,
      sync_error: result.syncStatus === 'sync_failed' ? result.message : null,
      last_synced_at: result.syncStatus === 'synced_to_er' ? new Date().toISOString() : null,
    })
    .eq('id', requestId);
}

export async function syncApprovedRequestToEr(
  localSupabase: SupabaseClient,
  requestId: string,
): Promise<SyncResult> {
  const { data: ticket, error } = await localSupabase
    .from('service_requests')
    .select(requestSelect)
    .eq('id', requestId)
    .single();

  if (error || !ticket) {
    throw new Error(error?.message || 'Approved request could not be found for ER sync.');
  }

  const localTicket = ticket as unknown as LocalServiceRequest;

  if (localTicket.verification_status !== 'approved') {
    return {
      ok: false,
      mode: 'not_configured',
      erTicketId: null,
      message: 'Only approved tickets are allowed to sync to ER.',
    };
  }

  await updateLocalSyncState(localSupabase, requestId, {
    syncStatus: 'pending_er_sync',
    erTicketId: null,
    message: 'Waiting for ER sync.',
  });

  const hasApiSync = Boolean(process.env.ER_SYNC_API_URL?.trim());
  const hasSupabaseSync = isErSupabaseConfigured();

  if (!hasApiSync && !hasSupabaseSync) {
    const result = {
      ok: false,
      mode: 'not_configured' as const,
      erTicketId: null,
      message: 'Ticket approved locally. Add ER_SYNC_API_URL or ER_SUPABASE_URL/ER_SUPABASE_SERVICE_ROLE_KEY to enable ER sync.',
    };

    await updateLocalSyncState(localSupabase, requestId, {
      syncStatus: 'pending_er_sync',
      erTicketId: null,
      message: result.message,
    });

    return result;
  }

  try {
    const result = hasApiSync
      ? await syncViaApi(localTicket)
      : await syncViaSupabase(localTicket);

    await updateLocalSyncState(localSupabase, requestId, {
      syncStatus: 'synced_to_er',
      erTicketId: result.erTicketId,
      message: result.message,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown ER sync error.';
    const result = {
      ok: false,
      mode: hasApiSync ? 'api' as const : 'supabase' as const,
      erTicketId: null,
      message,
    };

    await updateLocalSyncState(localSupabase, requestId, {
      syncStatus: 'sync_failed',
      erTicketId: null,
      message,
    });

    return result;
  }
}
