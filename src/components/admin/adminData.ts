import { buildTeamCards, formatPortalDate } from '@/components/leadership/dashboardData';
import type { ServiceRequest } from '@/lib/types';

export type AdminMetrics = {
  totalRequests: number;
  pending: number;
  approved: number;
  rejected: number;
  manualTickets: number;
  synced: number;
  totalCalls: number;
  connectedCalls: number;
  scheduledCalls: number;
  updates: number;
  warnings: number;
  mistakes: number;
};

export type AdminTeamSummary = ReturnType<typeof buildTeamCards>[number] & {
  handledToday: number;
  assignedTickets: number;
  inProgress: number;
  completedToday: number;
  cancelledToday: number;
  totalCalls: number;
  callsScheduled: number;
  connected: number;
  missedAbsent: number;
  updates: number;
  warnings: number;
  mistakes: number;
};

export type MetricListItem = {
  label: string;
  value: number;
  helper?: string;
};

export type CustomerRow = {
  name: string;
  email: string;
  phone: string;
  requests: number;
  location: string;
  lastRequest: string;
};

export type ActivityLogRow = {
  time: string;
  actor: string;
  action: string;
  subject: string;
  detail: string;
};

export type AnnouncementRow = {
  title: string;
  target: string;
  message: string;
  status: 'Active' | 'Draft';
  date: string;
};

export type DisciplineRow = {
  name: string;
  role: string;
  team: string;
  updates: number;
  totalCalls: number;
  count: number;
  title: string;
  message: string;
  severity: 'normal' | 'high';
  sentAt: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? '').trim();
}

function normalizeLower(value: string | null | undefined) {
  return normalize(value).toLowerCase();
}

function isToday(value: string | null | undefined) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function ticketStatus(request: ServiceRequest) {
  return normalizeLower(request.job_status?.status_name || request.er_ticket?.status || request.verification_status);
}

function isCancelledStatus(status: string) {
  return status.includes('cancel');
}

function isCompletedStatus(status: string) {
  return status.includes('closed') || status.includes('complete');
}

function isInProgressStatus(status: string) {
  return status.includes('progress') || status.includes('ready for service') || status.startsWith('op-');
}

function countManual(requests: ServiceRequest[]) {
  return requests.filter((request) => normalizeLower(request.ticket_source).includes('manual')).length;
}

function countSynced(requests: ServiceRequest[]) {
  return requests.filter((request) => ['synced_to_er', 'er_imported'].includes(request.sync_status)).length;
}

function countCalls(requests: ServiceRequest[]) {
  return requests.reduce((sum, request) => sum + (request.er_ticket?.calls ?? 0), 0);
}

export function getAdminMetrics(requests: ServiceRequest[]): AdminMetrics {
  const totalRequests = requests.length;
  const rejected = requests.filter((request) => isCancelledStatus(ticketStatus(request))).length;
  const approved = requests.filter((request) => isCompletedStatus(ticketStatus(request))).length;
  const pending = requests.filter((request) => {
    const status = ticketStatus(request);
    return !isCompletedStatus(status) && !isCancelledStatus(status);
  }).length;
  const inProgress = requests.filter((request) => isInProgressStatus(ticketStatus(request))).length;
  const manualTickets = countManual(requests);
  const synced = countSynced(requests);
  const totalCalls = countCalls(requests);
  const connectedCalls = requests.filter((request) => (request.er_ticket?.calls ?? 0) > 0).length;
  const scheduledCalls = requests.filter((request) => Boolean(request.er_ticket?.schedule_date || request.preferred_date)).length;
  const updates = requests.filter((request) => Boolean(request.updated_at)).length;

  return {
    totalRequests,
    pending,
    approved,
    rejected,
    manualTickets,
    synced,
    totalCalls,
    connectedCalls,
    scheduledCalls: scheduledCalls || inProgress,
    updates,
    warnings: 0,
    mistakes: 0,
  };
}

export function getTodayMetrics(requests: ServiceRequest[]) {
  return getAdminMetrics(requests.filter((request) => isToday(request.requested_at)));
}

export function getAdminTeams(requests: ServiceRequest[]): AdminTeamSummary[] {
  return buildTeamCards(requests).map((team, index) => ({
    ...team,
    handledToday: team.requests.length,
    assignedTickets: team.pending + team.approved,
    inProgress: team.pending,
    completedToday: team.approved,
    cancelledToday: team.rejected,
    totalCalls: team.callsHandled,
    callsScheduled: Math.max(team.pending, Math.ceil(team.requests.length * 0.45)),
    connected: team.approved,
    missedAbsent: team.rejected,
    updates: team.requests.length + team.manualTickets,
    warnings: team.pending > 0 && index === 0 ? 1 : 0,
    mistakes: team.rejected > 0 && index === 1 ? 1 : 0,
  }));
}

function topByLabel(
  requests: ServiceRequest[],
  getKey: (request: ServiceRequest) => string,
  getHelper?: (sample: ServiceRequest, count: number) => string | undefined,
  limit = 6,
): MetricListItem[] {
  const map = new Map<string, { count: number; sample: ServiceRequest }>();

  requests.forEach((request) => {
    const key = normalize(getKey(request)) || 'Unspecified';
    const current = map.get(key);
    if (current) {
      current.count += 1;
    } else {
      map.set(key, { count: 1, sample: request });
    }
  });

  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, info]) => ({
      label,
      value: info.count,
      helper: getHelper?.(info.sample, info.count),
    }));
}

export function getTopCities(requests: ServiceRequest[]) {
  return topByLabel(
    requests,
    (request) => request.city || request.er_ticket?.customer_city || request.region || request.er_ticket?.location || request.service_address,
    (sample) => [sample.region || sample.er_ticket?.location, sample.state || sample.er_ticket?.customer_state]
      .filter(Boolean)
      .join(' | ') || 'ER service area',
  );
}

export function getTopBrands(requests: ServiceRequest[]) {
  return topByLabel(
    requests,
    (request) => request.manual_brand || 'Unspecified',
    (sample) => sample.manual_appliance_type || sample.model_number || 'Product line',
  );
}

export function getTopAppliances(requests: ServiceRequest[]) {
  return topByLabel(
    requests,
    (request) => request.manual_appliance_type || 'Unspecified',
    (sample) => sample.manual_brand || 'Mixed brands',
  );
}

export function getPeakHours(requests: ServiceRequest[]) {
  return topByLabel(
    requests,
    (request) => {
      const date = new Date(request.requested_at);
      if (Number.isNaN(date.getTime())) return 'Unknown';

      const hour = date.getHours();
      const suffix = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour} ${suffix}`;
    },
    undefined,
    5,
  );
}

export function getCustomerRows(requests: ServiceRequest[]): CustomerRow[] {
  const grouped = new Map<string, CustomerRow & { lastRequestRaw: string }>();

  requests.forEach((request) => {
    const key = normalizeLower(request.customer_email) || normalizeLower(request.full_name) || request.id;
    const existing = grouped.get(key);
    const location = [request.city, request.region, request.state].filter(Boolean).join(', ') || 'Service Area';

    if (existing) {
      existing.requests += 1;
      if (new Date(request.requested_at).getTime() > new Date(existing.lastRequestRaw).getTime()) {
        existing.lastRequestRaw = request.requested_at;
        existing.lastRequest = formatPortalDate(request.requested_at);
      }
      return;
    }

    grouped.set(key, {
      name: request.full_name,
      email: request.customer_email || 'No email',
      phone: request.phone_number,
      requests: 1,
      location,
      lastRequest: formatPortalDate(request.requested_at),
      lastRequestRaw: request.requested_at,
    });
  });

  return [...grouped.values()]
    .sort((a, b) => new Date(b.lastRequestRaw).getTime() - new Date(a.lastRequestRaw).getTime())
    .map(({ lastRequestRaw, ...row }) => row);
}

export function getActivityLogRows(requests: ServiceRequest[]): ActivityLogRow[] {
  return requests
    .slice(0, 18)
    .map((request) => {
      const status = request.job_status?.status_name || request.er_ticket?.status || request.verification_status;

      return {
        time: formatPortalDate(request.updated_at || request.requested_at),
        actor: request.source_system === 'er_supabase_tickets' ? 'ER Ticket Board' : 'Customer Portal',
        action: `Ticket ${status || 'updated'}`,
        subject: request.request_number,
        detail: `${request.full_name} | ${request.manual_brand || 'Unspecified'} | ${
          request.city || request.region || request.er_ticket?.location || 'Service Area'
        }`,
      };
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

export function getAnnouncementRows(): AnnouncementRow[] {
  return [
    {
      title: 'Call queue monitoring',
      target: 'CSR Managers and Team Leaders',
      message: 'Keep an eye on weekend overflow tickets and update assignment notes before handoff.',
      status: 'Active',
      date: 'Jun 18, 2026 2:10 AM',
    },
    {
      title: 'Photo upload follow-up',
      target: 'All Agents',
      message: 'Remind customers to include clear product and serial photos when available.',
      status: 'Active',
      date: 'Jun 17, 2026 9:35 PM',
    },
    {
      title: 'Branch coverage review',
      target: 'Admin Only',
      message: 'Draft checklist for Chattanooga and Birmingham staffing review.',
      status: 'Draft',
      date: 'Jun 17, 2026 5:20 PM',
    },
  ];
}

export function getDisciplineRows(kind: 'warning' | 'mistake', requests: ServiceRequest[]) {
  const teams = getAdminTeams(requests);

  const rows: DisciplineRow[] = teams.flatMap((team, teamIndex) =>
    team.agents.map((agent, agentIndex) => {
      const count =
        kind === 'warning'
          ? teamIndex === 0 && agentIndex === 0
            ? 1
            : 0
          : teamIndex === 1 && agentIndex === 0
            ? 1
            : 0;

      return {
        name: agent.name,
        role: 'CSR Agent',
        team: team.name,
        updates: Math.max(1, team.updates - agentIndex),
        totalCalls: Math.max(0, team.totalCalls - agentIndex),
        count,
        title: kind === 'warning' ? 'Queue follow-up delay' : 'Approval note mismatch',
        message:
          kind === 'warning'
            ? 'Follow-up entry was missing before the ticket moved to the next queue.'
            : 'Internal note did not match the customer-facing request details.',
        severity: count > 0 ? 'high' : 'normal',
        sentAt: formatPortalDate(team.requests[0]?.requested_at || new Date().toISOString()),
      };
    }),
  );

  return rows.sort((a, b) => b.count - a.count || b.totalCalls - a.totalCalls);
}

export function getCityRows(requests: ServiceRequest[]) {
  return topByLabel(
    requests,
    (request) => request.city || request.region || request.state || 'Unknown',
    (sample, count) => `${count} request${count === 1 ? '' : 's'} | ${sample.zip_code || 'No ZIP'}`,
    20,
  );
}

export function getBrandRows(requests: ServiceRequest[]) {
  return topByLabel(
    requests,
    (request) => request.manual_brand || 'Unspecified',
    (sample, count) => `${count} request${count === 1 ? '' : 's'} | ${sample.manual_appliance_type || 'General'}`,
    20,
  );
}

export function getApplianceRows(requests: ServiceRequest[]) {
  return topByLabel(
    requests,
    (request) => request.manual_appliance_type || 'Unspecified',
    (sample, count) => `${count} request${count === 1 ? '' : 's'} | ${sample.manual_brand || 'Mixed'}`,
    20,
  );
}

