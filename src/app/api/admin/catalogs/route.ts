import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getErSupabaseAdmin, isErSupabaseConfigured } from '@/lib/supabase/er-admin';

const catalogTypeSchema = z.enum(['brands', 'appliances', 'activity-logs', 'customers', 'staff']);

const brandSchema = z.object({
  name: z.string().min(1, 'Brand name is required.'),
});

const applianceSchema = z.object({
  name: z.string().min(1, 'Appliance name is required.'),
  sort_order: z.coerce.number().int().optional().default(0),
});

const customerPatchSchema = z.object({
  is_active: z.boolean(),
});

function normalize(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function actionLabel(action: string) {
  return action
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusValue(value: string | null | undefined) {
  const map: Record<string, string> = {
    '1': 'New Request',
    '2': 'Assigned',
    '3': 'In Progress',
    '4': 'Repair Completed',
    '5': 'Cancelled',
  };

  return value ? map[value] ?? value : '';
}

function describeLog(log: {
  action: string;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  legacy_request_id: number | null;
  actor_name: string | null;
}) {
  const actor = log.actor_name || 'System';
  const requestLabel = log.legacy_request_id ? `#${log.legacy_request_id}` : 'ticket';

  if (log.action === 'status_change') {
    return `${actor} moved ticket ${requestLabel} from ${statusValue(log.old_value)} to ${statusValue(log.new_value)}.`;
  }

  if (log.action === 'manual_ticket_created') {
    return `${actor} created manual ticket ${log.new_value || requestLabel}.`;
  }

  if (log.action === 'request_claimed') {
    return `${actor} claimed ticket ${requestLabel}${log.notes ? ` — ${log.notes}` : ''}.`;
  }

  return `${actor} updated ${requestLabel}${log.notes ? ` — ${log.notes}` : ''}.`;
}


type ErAuditLogRow = {
  id: string;
  company_id: string | null;
  ticket_id: string | null;
  action: string;
  field: string | null;
  before_value: string | null;
  after_value: string | null;
  changed_by: string | null;
  created_at: string;
};

type ErAuditTicketRow = {
  id: string;
  ticket_no: string | null;
  customer_id: string | null;
  ticket_source: string | null;
  warranty: string | null;
  manufacturer: string | null;
  model: string | null;
  model_version: string | null;
  serial: string | null;
  product_type: string | null;
  purchase_date: string | null;
  status: string | null;
  location: string | null;
  technician: string | null;
  schedule_date: string | null;
  time_slot: string | null;
  problem_description: string | null;
  internal_note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ErAuditCustomerRow = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

type ErActorRow = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
};


type ErStaffRow = {
  id: string;
  company_id?: string | null;
  email?: string | null;
  username?: string | null;
  display_name?: string | null;
  role?: string | null;
  phone_number?: string | null;
  employee_id?: string | null;
  department?: string | null;
  permissions?: unknown;
  is_active?: boolean | null;
  last_login?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
  manager_name?: string | null;
  assigned_branch?: string | null;
  branch_access?: string | null;
  technician_id?: string | null;
  po_initials?: string | null;
  required_check_in?: string | null;
  required_check_out?: string | null;
  email_report_location?: string | null;
  sms_status?: string | null;
  off_days?: unknown;
  work_plan?: unknown;
  employee_info?: unknown;
};

function tableName(envName: string, fallback: string) {
  return process.env[envName]?.trim() || fallback;
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function titleFromAction(action: string, field?: string | null) {
  if (action === 'status_change') return 'Status Change';
  if (action === 'reschedule') return 'Schedule Change';
  if (field) return `${actionLabel(field)} Updated`;
  return actionLabel(action || 'ticket_update');
}

function fullName(row?: ErAuditCustomerRow | ErActorRow) {
  if (!row) return null;
  const full = textValue(row.full_name) || textValue((row as ErActorRow).display_name);
  if (full) return full;
  const firstLast = [textValue(row.first_name), textValue(row.last_name)].filter(Boolean).join(' ');
  return firstLast || textValue((row as ErActorRow).username) || null;
}

function describeErAuditLog(
  log: ErAuditLogRow,
  ticket?: ErAuditTicketRow,
  customer?: ErAuditCustomerRow,
  actor?: ErActorRow,
) {
  const ticketLabel = ticket?.ticket_no || (log.ticket_id ? `Ticket ${log.ticket_id.slice(0, 8)}` : 'ticket');
  const actorLabel = fullName(actor) || (log.changed_by ? `ER User ${log.changed_by.slice(0, 8)}` : 'ER System');
  const customerLabel = fullName(customer);
  const customerText = customerLabel ? ` for ${customerLabel}` : '';
  const beforeValue = log.before_value || 'blank';
  const afterValue = log.after_value || 'blank';

  if (log.action === 'status_change') {
    return `${actorLabel} changed ${ticketLabel}${customerText} status from ${beforeValue} to ${afterValue}.`;
  }

  if (log.action === 'reschedule') {
    return `${actorLabel} rescheduled ${ticketLabel}${customerText} from ${beforeValue} to ${afterValue}.`;
  }

  const fieldLabel = log.field ? actionLabel(log.field) : 'ticket details';
  return `${actorLabel} updated ${fieldLabel} on ${ticketLabel}${customerText} from ${beforeValue} to ${afterValue}.`;
}

async function getErActorMap(actorIds: string[]) {
  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase || !actorIds.length) return new Map<string, ErActorRow>();

  const tableCandidates = Array.from(new Set([
    tableName('ER_PROFILES_TABLE', 'profiles'),
    'profiles',
    'users',
  ].filter(Boolean)));

  for (const table of tableCandidates) {
    // ER ticket_audit_log.changed_by matches public.profiles.id in the ER database.
    // Select only columns that exist in the exported profiles table. If another ER project
    // uses a different users table, the fallback below still allows the page to load.
    const profileSelect = table === tableName('ER_PROFILES_TABLE', 'profiles') || table === 'profiles'
      ? 'id, display_name, username, email, role'
      : 'id, full_name, first_name, last_name, email, role';

    const { data, error } = await erSupabase
      .from(table)
      .select(profileSelect)
      .in('id', actorIds);

    if (!error && data) {
      return new Map(
        (data as unknown as ErActorRow[])
          .map((row) => [row.id, row] as const)
          .filter(([id]) => Boolean(id)),
      );
    }
  }

  return new Map<string, ErActorRow>();
}

async function getErActivityLogs() {
  if (!isErSupabaseConfigured()) return null;
  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase) return null;

  const auditTable = tableName('ER_TICKET_AUDIT_LOG_TABLE', 'ticket_audit_log');
  let query = erSupabase
    .from(auditTable)
    .select('id, company_id, ticket_id, action, field, before_value, after_value, changed_by, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (process.env.ER_TICKET_VIEW_COMPANY_ID?.trim()) {
    query = query.eq('company_id', process.env.ER_TICKET_VIEW_COMPANY_ID.trim());
  }

  const { data, error } = await query;
  if (error) return null;

  const logs = (data ?? []) as unknown as ErAuditLogRow[];
  const ticketIds = Array.from(new Set(logs.map((log) => log.ticket_id).filter((id): id is string => Boolean(id))));
  const actorIds = Array.from(new Set(logs.map((log) => log.changed_by).filter((id): id is string => Boolean(id))));

  let ticketsById = new Map<string, ErAuditTicketRow>();
  let customersById = new Map<string, ErAuditCustomerRow>();

  if (ticketIds.length) {
    const { data: tickets, error: ticketError } = await erSupabase
      .from(tableName('ER_SUPABASE_TICKETS_TABLE', 'tickets'))
      .select('id, ticket_no, customer_id, ticket_source, warranty, manufacturer, model, model_version, serial, product_type, purchase_date, status, location, technician, schedule_date, time_slot, problem_description, internal_note, created_at, updated_at')
      .in('id', ticketIds);

    if (!ticketError && tickets) {
      const ticketRows = tickets as unknown as ErAuditTicketRow[];
      ticketsById = new Map(ticketRows.map((ticket) => [ticket.id, ticket] as const));
      const customerIds = Array.from(new Set(ticketRows.map((ticket) => textValue(ticket.customer_id)).filter((id): id is string => Boolean(id))));

      if (customerIds.length) {
        const { data: customers, error: customerError } = await erSupabase
          .from(tableName('ER_SUPABASE_CUSTOMERS_TABLE', 'customers'))
          .select('id, full_name, first_name, last_name, phone, email, address, city, state, zip')
          .in('id', customerIds);

        if (!customerError && customers) {
          customersById = new Map((customers as unknown as ErAuditCustomerRow[]).map((customer) => [customer.id, customer] as const));
        }
      }
    }
  }

  const actorsById = await getErActorMap(actorIds);

  return logs.map((log) => {
    const ticket = log.ticket_id ? ticketsById.get(log.ticket_id) : undefined;
    const customer = ticket?.customer_id ? customersById.get(ticket.customer_id) : undefined;
    const actor = log.changed_by ? actorsById.get(log.changed_by) : undefined;
    const ticketLabel = ticket?.ticket_no || (log.ticket_id ? log.ticket_id.slice(0, 8) : null);
    const title = titleFromAction(log.action, log.field);
    const customerLabel = fullName(customer);
    const actorLabel = fullName(actor) || (log.changed_by ? `ER User ${log.changed_by.slice(0, 8)}` : 'ER System');

    return {
      id: log.id,
      legacy_id: null,
      legacy_request_id: null,
      ticket_id: log.ticket_id,
      ticket_no: ticket?.ticket_no ?? null,
      ticket_status: ticket?.status ?? null,
      ticket_location: ticket?.location ?? null,
      ticket_product: ticket?.product_type ?? null,
      ticket_brand: ticket?.manufacturer ?? null,
      customer_name: customerLabel,
      customer_phone: customer?.phone ?? null,
      user_id: null,
      user_role: actor?.role ?? 'ER User',
      actor_name: actorLabel,
      actor_email: actor?.email ?? null,
      actor_role_label: actor?.role ?? 'ER User',
      action: log.action,
      action_label: title,
      field: log.field,
      old_value: log.before_value,
      new_value: log.after_value,
      old_value_label: log.before_value,
      new_value_label: log.after_value,
      notes: [ticketLabel ? `Ticket ${ticketLabel}` : null, customerLabel, ticket?.location, ticket?.product_type]
        .filter(Boolean)
        .join(' | ') || null,
      ip_address: null,
      summary: describeErAuditLog(log, ticket, customer, actor),
      created_at: log.created_at,
    };
  });
}

async function getRequestsForCounts() {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  const rows: Array<{
    id: string;
    customer_id: string | null;
    customer_email: string | null;
    brand_id: string | null;
    appliance_type_id: string | null;
    manual_brand: string | null;
    manual_appliance_type: string | null;
  }> = [];

  for (let from = 0; from < 5000; from += pageSize) {
    const { data, error } = await supabase
      .from('service_requests')
      .select('id, customer_id, customer_email, brand_id, appliance_type_id, manual_brand, manual_appliance_type')
      .range(from, from + pageSize - 1);

    if (error) return rows;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function getBrands() {
  const supabase = getSupabaseAdmin();
  const [{ data: brands, error }, requests] = await Promise.all([
    supabase
      .from('brands')
      .select('id, legacy_id, name, logo_url, created_at, updated_at')
      .order('name', { ascending: true }),
    getRequestsForCounts(),
  ]);

  if (error) throw new Error(error.message);

  return (brands ?? []).map((brand) => {
    const brandId = String(brand.id);
    const brandName = normalize(brand.name).toLowerCase();
    const request_count = requests.filter((request) => {
      const manual = normalize(request.manual_brand).toLowerCase();
      return request.brand_id === brandId || Boolean(brandName && manual === brandName);
    }).length;

    return {
      ...brand,
      request_count,
      is_used: request_count > 0,
    };
  });
}

async function getAppliances() {
  const supabase = getSupabaseAdmin();
  const [{ data: appliances, error }, requests] = await Promise.all([
    supabase
      .from('appliance_types')
      .select('id, legacy_id, name, icon_class, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    getRequestsForCounts(),
  ]);

  if (error) throw new Error(error.message);

  return (appliances ?? []).map((appliance) => {
    const applianceId = String(appliance.id);
    const applianceName = normalize(appliance.name).toLowerCase();
    const request_count = requests.filter((request) => {
      const manual = normalize(request.manual_appliance_type).toLowerCase();
      return request.appliance_type_id === applianceId || Boolean(applianceName && manual === applianceName);
    }).length;

    return {
      ...appliance,
      request_count,
      is_used: request_count > 0,
    };
  });
}

async function getCustomers() {
  const supabase = getSupabaseAdmin();
  const [{ data: customers, error }, requests] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, legacy_id, first_name, last_name, email, phone_number, address, region, city, state, zip_code, is_active, created_at, updated_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .limit(1000),
    getRequestsForCounts(),
  ]);

  if (error) throw new Error(error.message);

  return (customers ?? []).map((customer) => {
    const customerId = String(customer.id);
    const email = normalize(customer.email).toLowerCase();
    const request_count = requests.filter((request) => {
      const requestEmail = normalize(request.customer_email).toLowerCase();
      return request.customer_id === customerId || Boolean(email && requestEmail === email);
    }).length;

    return {
      ...customer,
      full_name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email,
      request_count,
    };
  });
}


function cleanRole(role: string | null | undefined) {
  return textValue(role) || 'Unassigned';
}

function roleLabel(role: string | null | undefined) {
  const normalized = cleanRole(role);
  const map: Record<string, string> = {
    SUPERADMIN: 'Super Admin',
    ADMIN: 'Admin',
    CSR_AGENT: 'CSR Agent',
    CSR_TEAM_LEADER: 'CSR Team Leader',
    CSR_MANAGER: 'CSR Manager',
    MANAGER: 'Manager',
    TECHNICIAN: 'Technician',
    FINANCE: 'Finance',
    HR: 'HR',
  };

  return map[normalized] ?? normalized
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function roleFamily(role: string | null | undefined) {
  const value = cleanRole(role).toLowerCase().replace(/[-_\s]+/g, ' ').trim();
  if (value.includes('superadmin') || value.includes('super admin') || value === 'admin') return 'admin';
  if (value.includes('team leader') || value === 'tl') return 'team_leader';
  if (value.includes('branch manager')) return 'branch_manager';
  if (value.includes('csr manager') || value.includes('parts manager') || value === 'manager') return 'manager';
  if (value.includes('csr agent') || value.includes('agent') || value === 'csr') return 'agent';
  if (value.includes('technician')) return 'technician';
  if (value.includes('finance')) return 'finance';
  if (value === 'hr' || value.includes('human')) return 'hr';
  return 'other';
}

function isUsableBranch(value: string | null | undefined) {
  const branch = textValue(value);
  return Boolean(branch && branch !== '-' && !/^\d+$/.test(branch));
}

function compactBranchName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function splitBranches(value: string | null | undefined, knownBranches: string[] = []) {
  const source = textValue(value);
  if (!source) return [];

  const exactKnown = new Map(knownBranches.map((branch) => [compactBranchName(branch), branch] as const));
  const parts = source.split('|').map((branch) => branch.trim()).filter(Boolean);
  const expanded = parts.flatMap((part) => {
    const compactPart = compactBranchName(part);
    const exact = exactKnown.get(compactPart);
    if (exact) return [exact];

    if (part.includes(',')) {
      const matches = knownBranches.filter((branch) => compactPart.includes(compactBranchName(branch)));
      if (matches.length > 1) return matches;
    }

    return [part];
  });

  return Array.from(new Set(expanded.filter((branch) => isUsableBranch(branch))));
}

function inferInitials(name: string | null, email: string | null) {
  const source = name || email || 'Staff';
  const words = source.replace(/[^a-zA-Z0-9\s.]/g, ' ').split(/[\s.]+/).filter(Boolean);
  return (words.slice(0, 2).map((word) => word.charAt(0)).join('') || 'ST').toUpperCase();
}

function compactWorkPlan(workPlan: unknown) {
  if (!workPlan || typeof workPlan !== 'object' || Array.isArray(workPlan)) return { branch_count: 0, branches: [] as string[] };
  const branchNames = Object.keys(workPlan as Record<string, unknown>)
    .filter((branch) => isUsableBranch(branch))
    .sort((a, b) => a.localeCompare(b));
  return { branch_count: branchNames.length, branches: branchNames };
}

async function getErStaffProfiles() {
  if (!isErSupabaseConfigured()) {
    throw new Error('The ER Supabase staff directory is not configured.');
  }
  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase) {
    throw new Error('The ER Supabase staff connection is unavailable.');
  }

  const profilesTable = tableName('ER_PROFILES_TABLE', 'profiles');
  let query = erSupabase
    .from(profilesTable)
    .select('id, company_id, email, username, display_name, role, phone_number, employee_id, department, permissions, is_active, last_login, created_at, created_by, updated_at, manager_name, assigned_branch, branch_access, technician_id, po_initials, required_check_in, required_check_out, email_report_location, sms_status, off_days, work_plan, employee_info')
    .order('display_name', { ascending: true })
    .limit(1000);

  if (process.env.ER_TICKET_VIEW_COMPANY_ID?.trim()) {
    query = query.eq('company_id', process.env.ER_TICKET_VIEW_COMPANY_ID.trim());
  }

  const { data, error } = await query;
  if (error) throw new Error(`Unable to load ER staff profiles: ${error.message}`);

  const staffRows = (data ?? []) as unknown as ErStaffRow[];
  const knownBranches = Array.from(new Set(staffRows.flatMap((staff) => compactWorkPlan(staff.work_plan).branches)));

  return staffRows
    .filter((staff) => cleanRole(staff.role).toLowerCase() !== 'customer')
    .map((staff) => {
      const name = textValue(staff.display_name) || textValue(staff.username) || textValue(staff.email) || 'Unnamed staff';
      const assignedBranch = isUsableBranch(staff.assigned_branch) ? textValue(staff.assigned_branch) : null;
      const branches = Array.from(new Set([
        ...(assignedBranch ? [assignedBranch] : []),
        ...splitBranches(staff.branch_access, knownBranches),
      ]));
      const plan = compactWorkPlan(staff.work_plan);
      const role = cleanRole(staff.role);

      return {
        id: staff.id,
        company_id: staff.company_id ?? null,
        email: textValue(staff.email),
        username: textValue(staff.username),
        display_name: name,
        role,
        role_label: roleLabel(role),
        role_family: roleFamily(role),
        phone_number: textValue(staff.phone_number),
        employee_id: textValue(staff.employee_id),
        department: textValue(staff.department),
        is_active: staff.is_active !== false,
        last_login: staff.last_login ?? null,
        created_at: staff.created_at ?? null,
        updated_at: staff.updated_at ?? null,
        created_by: staff.created_by ?? null,
        manager_name: textValue(staff.manager_name),
        assigned_branch: assignedBranch,
        branches,
        branch_count: branches.length,
        technician_id: textValue(staff.technician_id),
        po_initials: textValue(staff.po_initials) || inferInitials(name, staff.email ?? null),
        required_check_in: textValue(staff.required_check_in),
        required_check_out: textValue(staff.required_check_out),
        email_report_location: textValue(staff.email_report_location),
        sms_status: textValue(staff.sms_status),
        off_days: Array.isArray(staff.off_days) ? staff.off_days : [],
        work_plan_branch_count: plan.branch_count,
        work_plan_branches: plan.branches.slice(0, 80),
        source: 'ER profiles',
      };
    });
}

async function getStaffProfiles() {
  return getErStaffProfiles();
}

async function getActivityLogs() {
  const erLogs = await getErActivityLogs();
  if (erLogs) return erLogs;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('request_logs')
    .select('id, legacy_id, legacy_request_id, user_id, user_role, actor_name, actor_email, actor_role_label, action, old_value, new_value, notes, ip_address, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  return (data ?? []).map((log) => ({
    ...log,
    ticket_id: null,
    ticket_no: null,
    ticket_status: null,
    ticket_location: null,
    ticket_product: null,
    ticket_brand: null,
    customer_name: null,
    customer_phone: null,
    field: null,
    action_label: actionLabel(log.action),
    old_value_label: statusValue(log.old_value),
    new_value_label: statusValue(log.new_value),
    summary: describeLog(log),
  }));
}
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    const url = new URL(request.url);
    const type = catalogTypeSchema.parse(url.searchParams.get('type') ?? 'brands');

    if (type === 'activity-logs' || type === 'staff') {
      requireRole(context, ['admin', 'csr_manager']);
    } else {
      requireRole(context, ['admin']);
    }

    if (type === 'brands') return NextResponse.json({ brands: await getBrands() });
    if (type === 'appliances') return NextResponse.json({ appliances: await getAppliances() });
    if (type === 'customers') return NextResponse.json({ customers: await getCustomers() });
    if (type === 'staff') return NextResponse.json({ staff: await getStaffProfiles() });
    return NextResponse.json({ activity_logs: await getActivityLogs() });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load admin catalog.' },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    const url = new URL(request.url);
    const type = catalogTypeSchema.parse(url.searchParams.get('type') ?? 'brands');

    if (type === 'activity-logs') {
      requireRole(context, ['admin', 'csr_manager']);
    } else {
      requireRole(context, ['admin']);
    }
    const supabase = getSupabaseAdmin();

    if (type === 'brands') {
      const body = brandSchema.parse(await request.json());
      const { data, error } = await supabase
        .from('brands')
        .insert({ name: body.name.trim() })
        .select('id, legacy_id, name, logo_url, created_at, updated_at')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ brand: data }, { status: 201 });
    }

    if (type === 'appliances') {
      const body = applianceSchema.parse(await request.json());
      const { data, error } = await supabase
        .from('appliance_types')
        .insert({ name: body.name.trim(), icon_class: 'fas fa-tools', sort_order: body.sort_order })
        .select('id, legacy_id, name, icon_class, sort_order, created_at, updated_at')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ appliance: data }, { status: 201 });
    }

    throw new Error(type === 'activity-logs' || type === 'staff' ? `${type === 'staff' ? 'Staff profiles' : 'Activity logs'} are read-only.` : 'Customers are managed through activate/deactivate actions.');
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to save catalog item.' },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    const url = new URL(request.url);
    const type = catalogTypeSchema.parse(url.searchParams.get('type') ?? 'brands');

    if (type === 'activity-logs') {
      requireRole(context, ['admin', 'csr_manager']);
    } else {
      requireRole(context, ['admin']);
    }
    const id = z.string().uuid().parse(url.searchParams.get('id'));
    const supabase = getSupabaseAdmin();

    if (type === 'brands') {
      const body = brandSchema.parse(await request.json());
      const { data, error } = await supabase
        .from('brands')
        .update({ name: body.name.trim() })
        .eq('id', id)
        .select('id, legacy_id, name, logo_url, created_at, updated_at')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ brand: data });
    }

    if (type === 'appliances') {
      const body = applianceSchema.parse(await request.json());
      const { data, error } = await supabase
        .from('appliance_types')
        .update({ name: body.name.trim(), sort_order: body.sort_order })
        .eq('id', id)
        .select('id, legacy_id, name, icon_class, sort_order, created_at, updated_at')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ appliance: data });
    }

    if (type === 'customers') {
      const body = customerPatchSchema.parse(await request.json());
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: body.is_active })
        .eq('id', id)
        .eq('role', 'customer')
        .select('id, legacy_id, first_name, last_name, email, phone_number, address, region, city, state, zip_code, is_active, created_at, updated_at')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ customer: data });
    }

    throw new Error(type === 'staff' ? 'Staff profiles are read-only.' : 'Activity logs are read-only.');
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to update catalog item.' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    const url = new URL(request.url);
    const type = catalogTypeSchema.parse(url.searchParams.get('type') ?? 'brands');

    if (type === 'activity-logs') {
      requireRole(context, ['admin', 'csr_manager']);
    } else {
      requireRole(context, ['admin']);
    }
    const id = z.string().uuid().parse(url.searchParams.get('id'));
    const supabase = getSupabaseAdmin();

    if (type === 'brands') {
      const brands = await getBrands();
      const row = brands.find((brand) => brand.id === id);
      if (row?.request_count) throw new Error('This brand is already used in service requests. Rename it instead of deleting it.');
      const { error } = await supabase.from('brands').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    if (type === 'appliances') {
      const appliances = await getAppliances();
      const row = appliances.find((appliance) => appliance.id === id);
      if (row?.request_count) throw new Error('This appliance is already used in service requests. Rename it instead of deleting it.');
      const { error } = await supabase.from('appliance_types').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    throw new Error(type === 'customers' ? 'Deactivate customers instead of deleting them.' : type === 'staff' ? 'Staff profiles are read-only.' : 'Activity logs are read-only.');
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to delete catalog item.' },
      { status: 400 },
    );
  }
}
