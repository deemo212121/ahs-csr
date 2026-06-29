import type { ServiceRequest } from '@/lib/types';

export type TeamMember = {
  name: string;
  email: string;
  phone: string;
  role?: string;
  branch?: string;
  status: 'Active' | 'Inactive';
  lastLogin: string;
};

type TeamBlueprint = {
  name: string;
  leader: string;
  regions: string[];
  agents: TeamMember[];
};

export type StaffProfileForTeams = {
  id: string;
  display_name: string;
  email: string | null;
  username?: string | null;
  role_label: string;
  role_family: string;
  phone_number?: string | null;
  is_active: boolean;
  last_login?: string | null;
  manager_name: string | null;
  assigned_branch: string | null;
  branches: string[];
  work_plan_branches: string[];
};

export type TeamCardData = TeamBlueprint & {
  requests: ServiceRequest[];
  pending: number;
  approved: number;
  rejected: number;
  manualTickets: number;
  customerTickets: number;
  todayTickets: number;
  openTickets: number;
  completedTickets: number;
  callsHandled: number;
  inboundCalls: number;
  outboundCalls: number;
  approvedVerified: number;
};

export type CallActivityItem = {
  date: string;
  customer: string;
  status: string;
  duration: string;
  csr: string;
};

export type RequestBreakdown = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  manualTickets: number;
  customerTickets: number;
  todayTickets: number;
  manualToday: number;
  customerToday: number;
  openTickets: number;
  openToday: number;
  completedTickets: number;
  completedToday: number;
  cancelledTickets: number;
  assignedTickets: number;
  inProgressTickets: number;
  approvedVerified: number;
};

const teamBlueprints: TeamBlueprint[] = [
  {
    name: 'Team Daniela Mercado',
    leader: 'Daniela Mercado',
    regions: ['atlanta', 'decatur', 'georgia', 'dallas'],
    agents: [
      {
        name: 'Alona Ramos',
        email: 'alona.ramos@ushs.local',
        phone: '--',
        status: 'Active',
        lastLogin: 'Jun 18, 2026 11:44 PM',
      },
    ],
  },
  {
    name: 'Team Robyn Heredia',
    leader: 'Robyn Heredia',
    regions: ['birmingham', 'alabama', 'nashville', 'tennessee'],
    agents: [
      {
        name: 'Robyn Heredia',
        email: 'herediarobmae.rmh@gmail.com',
        phone: '--',
        status: 'Active',
        lastLogin: 'Jun 18, 2026 11:36 PM',
      },
    ],
  },
  {
    name: 'Team Rochelle Ortiz',
    leader: 'Rochelle Ortiz',
    regions: ['cape girardeau', 'arkansas', 'missouri', 'memphis'],
    agents: [
      {
        name: 'Rochelle Ortiz',
        email: 'rochelle.ortiz@ushs.local',
        phone: '--',
        status: 'Active',
        lastLogin: 'Jun 18, 2026 10:42 PM',
      },
    ],
  },
  {
    name: 'Team Shane Marie Rebadomia',
    leader: 'Shane Marie Rebadomia',
    regions: ['chattanooga', 'knoxville', 'little rock', 'jackson'],
    agents: [
      {
        name: 'Shane Marie Rebadomia',
        email: 'shane.rebadomia@ushs.local',
        phone: '--',
        status: 'Active',
        lastLogin: 'Jun 18, 2026 10:09 PM',
      },
    ],
  },
];

export const teamLeaderRoster = teamBlueprints[0].agents;

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function normalizeKey(value: string | null | undefined) {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

function cleanDisplay(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== '-' ? trimmed : '';
}

function countByStatus(requests: ServiceRequest[], status: ServiceRequest['verification_status']) {
  return requests.filter((request) => request.verification_status === status).length;
}

function countManualTickets(requests: ServiceRequest[]) {
  return requests.filter(isManualTicket).length;
}

function ticketSource(request: ServiceRequest) {
  return normalize([request.er_ticket?.ticket_source, request.ticket_source, request.source_system, request.origin_type].filter(Boolean).join(' '));
}

function isManualTicket(request: ServiceRequest) {
  const source = ticketSource(request);
  return source.includes('manual') || source.includes('csr_manual') || source.includes('php_csr');
}

function ticketStatus(request: ServiceRequest) {
  return normalize(request.er_ticket?.status || request.job_status?.status_name || request.verification_status);
}

function ticketStatusBucket(request: ServiceRequest) {
  const status = ticketStatus(request);
  if (status.includes('cancel') || status.includes('reject') || status.includes('void')) return 'cancelled';
  if (status.includes('complete') || status.includes('closed') || status.includes('done')) return 'completed';
  if (status.includes('progress') || status.includes('repair') || status.includes('diagnos') || status.includes('part')) return 'in_progress';
  if (status.includes('assign') || status.includes('schedule') || status.includes('dispatch') || status.includes('acknowledge')) return 'assigned';
  return 'new';
}

function createdAt(request: ServiceRequest) {
  return request.er_ticket?.created_at || request.requested_at || request.updated_at;
}

function isToday(value: string | null | undefined, now = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function requestBranchValues(request: ServiceRequest) {
  return [
    request.er_ticket?.location,
    request.region,
    request.city,
    request.state,
    request.service_address,
    request.er_ticket?.customer_city,
    request.er_ticket?.customer_state,
    [request.er_ticket?.customer_city, request.er_ticket?.customer_state].filter(Boolean).join(' '),
  ]
    .map((value) => normalizeKey(value))
    .filter(Boolean);
}

function profileBranches(profile: StaffProfileForTeams) {
  return Array.from(new Set([
    profile.assigned_branch,
    ...profile.branches,
    ...profile.work_plan_branches,
  ].map(cleanDisplay).filter(Boolean)));
}

function staffToMember(profile: StaffProfileForTeams): TeamMember {
  return {
    name: cleanDisplay(profile.display_name) || cleanDisplay(profile.username) || cleanDisplay(profile.email) || 'Unnamed staff',
    email: cleanDisplay(profile.email) || '--',
    phone: cleanDisplay(profile.phone_number) || '--',
    role: profile.role_label,
    branch: cleanDisplay(profile.assigned_branch) || profileBranches(profile)[0] || 'No branch',
    status: profile.is_active ? 'Active' : 'Inactive',
    lastLogin: formatPortalDate(profile.last_login),
  };
}

function staffTeamBlueprints(staffProfiles: StaffProfileForTeams[]) {
  const usableStaff = staffProfiles.filter((profile) => cleanDisplay(profile.display_name) || cleanDisplay(profile.email));
  const staffByName = new Map(usableStaff.map((profile) => [normalizeKey(profile.display_name), profile] as const));
  const leaderFamilies = new Set(['team_leader']);
  const teamMemberFamilies = new Set(['team_leader', 'agent']);
  const teamNames = new Set(
    usableStaff
      .filter((profile) => leaderFamilies.has(profile.role_family))
      .map((profile) => cleanDisplay(profile.display_name) || cleanDisplay(profile.email))
      .filter(Boolean),
  );

  usableStaff.forEach((profile) => {
    const managerName = cleanDisplay(profile.manager_name);
    if (managerName && staffByName.has(normalizeKey(managerName))) {
      const manager = staffByName.get(normalizeKey(managerName));
      if (manager && leaderFamilies.has(manager.role_family)) {
        teamNames.add(managerName);
      }
    }
  });

  const teams = Array.from(teamNames)
    .map((leaderName) => {
      const leader = staffByName.get(normalizeKey(leaderName));
      const members = usableStaff.filter((profile) => (
        teamMemberFamilies.has(profile.role_family)
        && (
          normalizeKey(profile.manager_name) === normalizeKey(leaderName)
          || normalizeKey(profile.display_name) === normalizeKey(leaderName)
        )
      ));

      const agents = members
        .filter((profile) => teamMemberFamilies.has(profile.role_family))
        .sort((a, b) => {
          const aLeader = normalizeKey(a.display_name) === normalizeKey(leaderName) ? 0 : 1;
          const bLeader = normalizeKey(b.display_name) === normalizeKey(leaderName) ? 0 : 1;
          return aLeader - bLeader || a.display_name.localeCompare(b.display_name);
        })
        .map(staffToMember);

      const regions = Array.from(new Set([
        ...(leader ? profileBranches(leader) : []),
        ...members.flatMap(profileBranches),
      ].map(normalize).filter(Boolean)));

      return {
        name: `Team ${leaderName}`,
        leader: leaderName,
        regions,
        agents,
      } satisfies TeamBlueprint;
    })
    .filter((team) => team.agents.length || team.regions.length)
    .sort((a, b) => a.leader.localeCompare(b.leader));

  return teams.length ? teams : teamBlueprints;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function requestMatchesTeam(request: ServiceRequest, team: TeamBlueprint) {
  const requestValues = requestBranchValues(request);
  const teamValues = team.regions.map(normalizeKey).filter(Boolean);

  if (!requestValues.length || !teamValues.length) return false;

  return teamValues.some((teamValue) => requestValues.some((requestValue) => (
    requestValue === teamValue || requestValue.includes(teamValue) || teamValue.includes(requestValue)
  )));
}

function legacyFallbackTeamIndex(request: ServiceRequest, teams: TeamBlueprint[], index: number) {
  const haystack = [
    request.region,
    request.city,
    request.state,
    request.service_address,
    request.er_ticket?.location,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const match = teams.findIndex((team) => team.regions.some((region) => haystack.includes(region)));
  return match >= 0 ? match : index % teams.length;
}

export function formatPortalDate(value: string | null | undefined) {
  if (!value) return '--';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getRequestBreakdown(requests: ServiceRequest[]): RequestBreakdown {
  const manualTickets = countManualTickets(requests);
  const customerTickets = Math.max(0, requests.length - manualTickets);
  const todayRequests = requests.filter((request) => isToday(createdAt(request)));
  const completedTickets = requests.filter((request) => ticketStatusBucket(request) === 'completed').length;
  const cancelledTickets = requests.filter((request) => ticketStatusBucket(request) === 'cancelled').length;
  const assignedTickets = requests.filter((request) => ticketStatusBucket(request) === 'assigned').length;
  const inProgressTickets = requests.filter((request) => ticketStatusBucket(request) === 'in_progress').length;
  const openTickets = Math.max(0, requests.length - completedTickets - cancelledTickets);
  const hasErTickets = requests.some((request) => request.er_ticket);

  return {
    total: requests.length,
    pending: hasErTickets ? openTickets : countByStatus(requests, 'pending'),
    approved: hasErTickets ? completedTickets : countByStatus(requests, 'approved'),
    rejected: hasErTickets ? cancelledTickets : countByStatus(requests, 'rejected'),
    manualTickets,
    customerTickets,
    todayTickets: todayRequests.length,
    manualToday: todayRequests.filter(isManualTicket).length,
    customerToday: Math.max(0, todayRequests.length - todayRequests.filter(isManualTicket).length),
    openTickets,
    openToday: todayRequests.filter((request) => !['completed', 'cancelled'].includes(ticketStatusBucket(request))).length,
    completedTickets,
    completedToday: todayRequests.filter((request) => ticketStatusBucket(request) === 'completed').length,
    cancelledTickets,
    assignedTickets,
    inProgressTickets,
    approvedVerified: hasErTickets ? completedTickets : countByStatus(requests, 'approved'),
  };
}

export function buildTeamCards(requests: ServiceRequest[], staffProfiles?: StaffProfileForTeams[]): TeamCardData[] {
  const blueprints = staffProfiles?.length ? staffTeamBlueprints(staffProfiles) : teamBlueprints;
  const strictStaffTeams = Boolean(staffProfiles?.length);
  const buckets = blueprints.map((team) => ({
    ...team,
    requests: [] as ServiceRequest[],
  }));

  const unmatched: ServiceRequest[] = [];

  requests.forEach((request, index) => {
    const match = buckets.find((team) => requestMatchesTeam(request, team));
    if (match) {
      match.requests.push(request);
      return;
    }

    if (!strictStaffTeams && buckets.length) {
      buckets[legacyFallbackTeamIndex(request, blueprints, index)].requests.push(request);
      return;
    }

    unmatched.push(request);
  });

  const mappedBuckets = buckets.filter((team) => team.agents.length || team.requests.length || team.regions.length);
  if (unmatched.length) {
    mappedBuckets.push({
      name: 'Unassigned / Other Tickets',
      leader: 'No matching ER team',
      regions: [],
      agents: [],
      requests: unmatched,
    });
  }

  return mappedBuckets.map((team) => {
    const breakdown = getRequestBreakdown(team.requests);
    const callsHandled = breakdown.total;
    const inboundCalls = breakdown.customerTickets;
    const outboundCalls = breakdown.manualTickets;

    return {
      ...team,
      pending: breakdown.pending,
      approved: breakdown.approved,
      rejected: breakdown.rejected,
      manualTickets: breakdown.manualTickets,
      customerTickets: breakdown.customerTickets,
      todayTickets: breakdown.todayTickets,
      openTickets: breakdown.openTickets,
      completedTickets: breakdown.completedTickets,
      callsHandled,
      inboundCalls,
      outboundCalls,
      approvedVerified: breakdown.approvedVerified,
    };
  });
}

export function buildCallActivity(requests: ServiceRequest[], fallbackCsrNames: string[]): CallActivityItem[] {
  if (!requests.length) {
    return [
      {
        date: 'Jun 17, 2026 4:29 PM',
        customer: 'Bubble Max / Decatur',
        status: 'completed',
        duration: '00:12',
        csr: fallbackCsrNames[0] ?? 'CSR Agent',
      },
      {
        date: 'Jun 17, 2026 4:11 PM',
        customer: 'Mitch Modelo / Chattanooga',
        status: 'completed',
        duration: '00:19',
        csr: fallbackCsrNames[1] ?? fallbackCsrNames[0] ?? 'CSR Agent',
      },
    ];
  }

  return requests.slice(0, 4).map((request, index) => ({
    date: formatPortalDate(request.requested_at),
    customer: `${request.full_name} / ${request.city || request.state || 'Service Area'}`,
    status: request.verification_status === 'approved' ? 'completed' : 'accepted',
    duration: formatDuration(12 * 60 + index * 7),
    csr: fallbackCsrNames[index % fallbackCsrNames.length] ?? 'CSR Agent',
  }));
}
