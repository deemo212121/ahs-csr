import type { ServiceRequest } from '@/lib/types';

function text(value?: string | number | boolean | null) {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function erStatusText(request: ServiceRequest) {
  return request.er_ticket?.status || request.job_status?.status_name || 'No Status';
}

export function erLocationText(request: ServiceRequest) {
  return request.er_ticket?.location || request.region || 'Unknown';
}

export function erSourceText(request: ServiceRequest) {
  return request.er_ticket?.ticket_source || request.ticket_source || 'Unknown';
}

export function erTicketSearchHaystack(request: ServiceRequest) {
  const er = request.er_ticket;
  return [
    request.request_number,
    er?.ticket_no,
    request.full_name,
    request.phone_number,
    request.customer_email,
    request.service_address,
    request.service_address_2,
    request.city,
    request.state,
    request.zip_code,
    er?.customer_name,
    er?.customer_phone,
    er?.customer_email,
    er?.customer_address,
    er?.customer_city,
    er?.customer_state,
    er?.customer_zip,
    er?.ticket_source,
    er?.warranty,
    er?.manufacturer,
    er?.product_type,
    er?.model,
    er?.serial,
    er?.location,
    er?.technician,
    er?.status,
    er?.part_order,
    er?.internal_note,
    er?.problem_description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function filterErTickets(
  requests: ServiceRequest[],
  filters: { search?: string; status?: string; location?: string; branches?: string[]; source?: string },
) {
  const needle = (filters.search || '').trim().toLowerCase();
  const status = filters.status || 'all';
  const location = filters.location || 'all';
  const source = filters.source || 'all';
  const branches = filters.branches;

  return requests.filter((request) => {
    if (status !== 'all' && erStatusText(request) !== status) return false;
    if (location !== 'all' && erLocationText(request) !== location) return false;
    if (branches && branches.length === 0) return false;
    if (branches && branches.length > 0 && !branches.includes(erLocationText(request))) return false;
    if (source !== 'all' && erSourceText(request) !== source) return false;
    if (!needle) return true;
    return erTicketSearchHaystack(request).includes(needle);
  });
}

export function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function branchTokens(value?: string | null) {
  return (value || '')
    .split(/[,;/|]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function assignedBranchesFromProfile(
  profile: { region?: string | null; city?: string | null } | null | undefined,
  branchOptions: string[],
) {
  const tokens = new Set([
    ...branchTokens(profile?.region),
    ...branchTokens(profile?.city),
  ]);

  if (!tokens.size) return [];

  return branchOptions.filter((branch) => {
    const normalized = branch.trim().toLowerCase();
    return tokens.has(normalized);
  });
}
