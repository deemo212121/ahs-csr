'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Ban,
  BookOpenText,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Headphones,
  Loader2,
  Megaphone,
  MessageCircle,
  PhoneCall,
  RotateCcw,
  ShieldAlert,
  Tags,
  Ticket,
  TriangleAlert,
  Users,
  UserRoundCog,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  AdminPageHeader,
  AdminPanel,
  AdminStatGrid,
  type AdminStat,
} from '@/components/admin/AdminUi';
import {
  getAdminMetrics,
  getAdminTeams,
  getAnnouncementRows,
  getDisciplineRows,
  getPeakHours,
  getTodayMetrics,
  getTopAppliances,
  getTopBrands,
  getTopCities,
} from '@/components/admin/adminData';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import type { ServiceRequest } from '@/lib/types';

function metricStats(metrics: ReturnType<typeof getAdminMetrics>, today = false): AdminStat[] {
  return [
    { label: today ? 'New Today' : 'Live ER Tickets', value: metrics.totalRequests, tone: 'cyan', icon: <ClipboardList size={17} /> },
    { label: 'Open Tickets', value: metrics.pending, tone: 'blue', icon: <Ticket size={17} /> },
    { label: 'In Progress', value: metrics.scheduledCalls, tone: 'purple', icon: <Loader2 size={17} /> },
    { label: today ? 'Closed Today' : 'Closed / Complete', value: metrics.approved, tone: 'green', icon: <CheckCircle2 size={17} /> },
    { label: today ? 'Cancelled Today' : 'Cancelled Tickets', value: metrics.rejected, tone: 'red', icon: <Ban size={17} /> },
    { label: 'Total Calls', value: metrics.totalCalls, tone: 'neutral', icon: <PhoneCall size={17} /> },
    { label: 'Scheduled Rows', value: metrics.scheduledCalls, tone: 'cyan', icon: <CalendarCheck size={17} /> },
    { label: 'With Calls', value: metrics.connectedCalls, tone: 'green', icon: <Headphones size={17} /> },
    { label: 'Manual Tickets', value: metrics.manualTickets, tone: 'yellow', icon: <TriangleAlert size={17} /> },
    { label: 'Updated Rows', value: metrics.updates, tone: 'purple', icon: <MessageCircle size={17} /> },
    { label: 'Warnings', value: metrics.warnings, tone: 'yellow', icon: <AlertTriangle size={17} /> },
    { label: 'Mistakes', value: metrics.mistakes, tone: 'red', icon: <RotateCcw size={17} /> },
  ];
}

function MetricList({ items }: { items: Array<{ label: string; value: number; helper?: string }> }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="admin-metric-list">
      {items.map((item) => (
        <div className="admin-metric-row" key={`${item.label}-${item.helper}`}>
          <div className="admin-metric-copy">
            <strong>{item.label}</strong>
            <span>{item.helper || `${item.value} requests`}</span>
          </div>
          <div className="admin-metric-visual">
            <div className="admin-metric-bar">
              <span style={{ width: `${Math.max(10, Math.round((item.value / max) * 100))}%` }} />
            </div>
            <b>{item.value}</b>
          </div>
        </div>
      ))}
    </div>
  );
}

type CoverageArea = {
  id: string;
  zip_code: string;
  city: string;
  region: string;
  location?: string | null;
  is_active: boolean;
};

type ErAuditActivityRow = {
  id: string;
  ticket_id?: string | null;
  ticket_no?: string | null;
  ticket_status?: string | null;
  ticket_location?: string | null;
  ticket_product?: string | null;
  ticket_brand?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role_label?: string | null;
  action: string;
  action_label?: string | null;
  field?: string | null;
  old_value_label?: string | null;
  new_value_label?: string | null;
  notes?: string | null;
  summary?: string | null;
  created_at: string;
};

type ActivityResponse = {
  activity_logs?: ErAuditActivityRow[];
};

type DashboardActivityItem = {
  id: string;
  badge: string;
  title: string;
  summary: string;
  actor: string;
  time: string;
  createdAt: string;
  meta: string;
  kind: 'audit' | 'ticket';
  auditLog?: ErAuditActivityRow;
  ticketRequest?: ServiceRequest;
};

const activityDateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function summarizeCoverage(areas: CoverageArea[]) {
  const active = areas.filter((area) => area.is_active);
  return {
    rows: areas.length,
    zips: new Set(active.map((area) => area.zip_code).filter(Boolean)).size,
    cities: new Set(active.map((area) => area.city).filter(Boolean)).size,
    locations: new Set(active.map((area) => area.location || area.region).filter(Boolean)).size,
  };
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return activityDateTime.format(date);
}

function activityBadge(action: string) {
  if (action === 'status_change') return 'Status';
  if (action === 'reschedule') return 'Schedule';
  if (action.includes('created')) return 'Created';
  return 'Update';
}

function toAuditActivity(log: ErAuditActivityRow): DashboardActivityItem {
  const ticketLabel = log.ticket_no || (log.ticket_id ? `Ticket ${log.ticket_id.slice(0, 8)}` : 'ER ticket');
  const change = [log.old_value_label, log.new_value_label].filter(Boolean).join(' → ');
  const context = [log.customer_name, log.ticket_product, log.ticket_brand, log.ticket_location]
    .filter(Boolean)
    .join(' • ');

  return {
    id: `audit-${log.id}`,
    badge: activityBadge(log.action),
    title: `${log.action_label || activityBadge(log.action)}${ticketLabel ? ` • ${ticketLabel}` : ''}`,
    summary: log.summary || log.notes || `${ticketLabel} was updated in the ER ticket audit log.`,
    actor: log.actor_name || log.actor_role_label || 'ER System',
    time: formatActivityTime(log.created_at),
    createdAt: log.created_at,
    meta: change || context || log.field?.replaceAll('_', ' ') || 'ER audit log',
    kind: 'audit',
    auditLog: log,
  };
}

function toTicketActivity(request: ServiceRequest): DashboardActivityItem {
  const status = request.job_status?.status_name || request.er_ticket?.status || request.verification_status || 'updated';
  const createdAt = request.updated_at || request.requested_at;
  const context = [
    request.full_name,
    request.manual_brand || request.er_ticket?.manufacturer || 'Unspecified',
    request.city || request.region || request.er_ticket?.location || 'Service Area',
  ]
    .filter(Boolean)
    .join(' • ');

  return {
    id: `ticket-${request.id}-${createdAt}`,
    badge: 'Ticket',
    title: `Ticket ${status} • ${request.request_number}`,
    summary: context,
    actor: request.source_system === 'er_supabase_tickets' ? 'ER Ticket Board' : 'Customer Portal',
    time: formatActivityTime(createdAt),
    createdAt,
    meta: 'Ticket row fallback',
    kind: 'ticket',
    ticketRequest: request,
  };
}


function ticketDisplayValue(value: string | number | null | undefined, fallback = 'N/A') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function ticketInfoLine(parts: Array<string | null | undefined>) {
  return parts.map((part) => ticketDisplayValue(part, '')).filter(Boolean).join(' • ') || 'No extra details available';
}

function ActivityDetailModal({
  activity,
  onClose,
}: {
  activity: DashboardActivityItem;
  onClose: () => void;
}) {
  const audit = activity.auditLog;
  const ticket = activity.ticketRequest;
  const ticketLabel = audit?.ticket_no || ticket?.request_number || audit?.ticket_id || ticket?.er_ticket_id || 'N/A';
  const ticketStatus = audit?.ticket_status || ticket?.job_status?.status_name || ticket?.er_ticket?.status || ticket?.verification_status || 'N/A';
  const customerName = audit?.customer_name || ticket?.full_name || ticket?.er_ticket?.customer_name || 'No customer linked';
  const customerContact = audit?.customer_phone || ticket?.phone_number || ticket?.er_ticket?.customer_phone || ticket?.customer_email || ticket?.er_ticket?.customer_email;
  const productLine = audit
    ? ticketInfoLine([audit.ticket_product, audit.ticket_brand, audit.ticket_location])
    : ticketInfoLine([
        ticket?.manual_appliance_type || ticket?.er_ticket?.product_type,
        ticket?.manual_brand || ticket?.er_ticket?.manufacturer,
        ticket?.city || ticket?.region || ticket?.er_ticket?.location,
      ]);

  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
      <div className="admin-log-modal admin-dashboard-activity-modal">
        <div className="admin-log-modal-head">
          <div>
            <span>{activity.kind === 'audit' ? 'ER Audit Detail' : 'Ticket Detail'}</span>
            <h2>{activity.title}</h2>
          </div>
          <button aria-label="Close recent activity details" onClick={onClose} type="button">×</button>
        </div>

        <div className="admin-log-modal-body">
          <div className="admin-log-detail-grid">
            <section>
              <span>Date / Time</span>
              <strong>{activity.time}</strong>
              <small>{activity.kind === 'audit' ? 'From ER ticket_audit_log' : 'From ticket row fallback'}</small>
            </section>
            <section>
              <span>Actor / Source</span>
              <strong>{activity.actor}</strong>
              <small>{audit?.actor_role_label || audit?.actor_email || ticket?.source_system || 'Dashboard activity'}</small>
            </section>
            <section>
              <span>Ticket / Request</span>
              <strong>{ticketLabel}</strong>
              <small>{ticketStatus}</small>
            </section>
            <section>
              <span>Customer / Ticket Info</span>
              <strong>{customerName}</strong>
              <small>{ticketInfoLine([customerContact, productLine])}</small>
            </section>
          </div>

          <section className="admin-log-change-box">
            <span>Summary</span>
            <p>{activity.summary}</p>
          </section>

          {audit ? (
            <div className="admin-log-before-after">
              <section>
                <span>Changed Field</span>
                <strong>{audit.field?.replaceAll('_', ' ') || audit.action_label || activity.badge}</strong>
              </section>
              <section>
                <span>Ticket ID</span>
                <strong>{ticketDisplayValue(audit.ticket_id)}</strong>
              </section>
              <section>
                <span>Before</span>
                <strong>{ticketDisplayValue(audit.old_value_label)}</strong>
              </section>
              <section>
                <span>After</span>
                <strong>{ticketDisplayValue(audit.new_value_label)}</strong>
              </section>
            </div>
          ) : (
            <div className="admin-log-before-after">
              <section>
                <span>Current Status</span>
                <strong>{ticketStatus}</strong>
              </section>
              <section>
                <span>Last Updated</span>
                <strong>{ticket?.updated_at ? formatActivityTime(ticket.updated_at) : activity.time}</strong>
              </section>
              <section>
                <span>Source</span>
                <strong>{ticketDisplayValue(ticket?.source_system || ticket?.ticket_source || ticket?.origin_type)}</strong>
              </section>
              <section>
                <span>Sync</span>
                <strong>{ticketDisplayValue(ticket?.sync_status)}</strong>
              </section>
            </div>
          )}

          {ticket ? (
            <section className="admin-log-change-box">
              <span>Ticket Details</span>
              <p>
                {ticketInfoLine([
                  ticket.service_address || ticket.er_ticket?.customer_address,
                  ticket.city || ticket.er_ticket?.customer_city,
                  ticket.state || ticket.er_ticket?.customer_state,
                  ticket.zip_code || ticket.er_ticket?.customer_zip,
                ])}
                <br />
                {ticketInfoLine([
                  ticket.issue_description || ticket.er_ticket?.problem_description,
                  ticket.special_request || ticket.er_ticket?.internal_note,
                ])}
              </p>
            </section>
          ) : null}

          {audit?.notes ? (
            <section className="admin-log-change-box">
              <span>Notes</span>
              <p>{audit.notes}</p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  const { requests, error } = useLeadershipRequests(500, 'view=tickets');
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<ErAuditActivityRow[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<DashboardActivityItem | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCoverage() {
      try {
        const response = await fetch('/api/service-areas?limit=15000');
        const data = (await response.json()) as { service_areas?: CoverageArea[]; message?: string };
        if (!response.ok) throw new Error(data.message || 'Unable to load ER coverage.');
        if (active) setCoverageAreas(data.service_areas ?? []);
      } catch (err) {
        if (active) setCoverageError(err instanceof Error ? err.message : 'Unable to load ER coverage.');
      }
    }

    void loadCoverage();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAuditActivity() {
      if (!user) {
        setAuditLogs([]);
        return;
      }

      setActivityError(null);
      try {
        const data = await fetchJsonWithFirebase<ActivityResponse>(user, '/api/admin/catalogs?type=activity-logs');
        if (active) setAuditLogs(data.activity_logs ?? []);
      } catch (err) {
        if (active) setActivityError(err instanceof Error ? err.message : 'Unable to load ER audit activity.');
      }
    }

    void loadAuditActivity();
    return () => {
      active = false;
    };
  }, [user]);

  const overall = useMemo(() => getAdminMetrics(requests), [requests]);
  const today = useMemo(() => getTodayMetrics(requests), [requests]);
  const teams = useMemo(() => getAdminTeams(requests), [requests]);
  const topCities = useMemo(() => getTopCities(requests), [requests]);
  const topBrands = useMemo(() => getTopBrands(requests), [requests]);
  const topAppliances = useMemo(() => getTopAppliances(requests), [requests]);
  const peakHours = useMemo(() => getPeakHours(requests), [requests]);
  const warnings = useMemo(() => getDisciplineRows('warning', requests).filter((row) => row.count > 0), [requests]);
  const mistakes = useMemo(() => getDisciplineRows('mistake', requests).filter((row) => row.count > 0), [requests]);
  const fallbackActivity = useMemo(() => requests.map(toTicketActivity), [requests]);
  const auditActivity = useMemo(() => auditLogs.map(toAuditActivity), [auditLogs]);
  const activity = useMemo(
    () => [...auditActivity, ...fallbackActivity]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8),
    [auditActivity, fallbackActivity],
  );
  const announcements = useMemo(() => getAnnouncementRows().slice(0, 2), []);
  const coverage = useMemo(() => summarizeCoverage(coverageAreas), [coverageAreas]);

  return (
    <div className="admin-dashboard">
      <AdminPageHeader
        description="Live overview based on the ER tickets table, customer records, ER audit logs, and ER location coverage."
        eyebrow="Administrator overview"
        title="Admin Dashboard"
      />

      <div className="admin-quick-bar">
        <Link className="btn btn-secondary" href="/admin/requests">
          <ClipboardList size={16} />
          Requests
        </Link>
        <Link className="btn btn-secondary" href="/admin/staff">
          <UserRoundCog size={16} />
          Staff
        </Link>
        <Link className="btn btn-secondary" href="/admin/announcements">
          <Megaphone size={16} />
          Announcements
        </Link>
        <Link className="btn btn-secondary" href="/admin/activity-logs">
          <BookOpenText size={16} />
          Activity Logs
        </Link>
        <Link className="btn btn-secondary" href="/admin/warning">
          <TriangleAlert size={16} />
          Warning
        </Link>
        <Link className="btn btn-secondary" href="/admin/mistake">
          <ShieldAlert size={16} />
          Mistake
        </Link>
      </div>

      {error ? <div className="customer-alert">{error}</div> : null}
      {coverageError ? <div className="customer-alert">{coverageError}</div> : null}
      {activityError ? <div className="customer-alert">Dashboard activity is showing ticket-row fallback only: {activityError}</div> : null}

      <AdminPanel subtitle="Live ER public.tickets data" title="Overall Ticket Total">
        <AdminStatGrid stats={metricStats(overall)} />
      </AdminPanel>

      <AdminPanel subtitle="ER tickets created or updated today" title="Today">
        <AdminStatGrid stats={metricStats(today, true)} />
      </AdminPanel>

      <div className="admin-grid-3">
        <AdminPanel subtitle="Top request locations" title="Top Service Areas">
          <MetricList items={topCities} />
        </AdminPanel>
        <AdminPanel subtitle="Most common brands" title="Top Brands">
          <MetricList items={topBrands} />
        </AdminPanel>
        <AdminPanel subtitle="Most requested product types" title="Top Appliances">
          <MetricList items={topAppliances.length ? topAppliances : peakHours} />
        </AdminPanel>
      </div>

      <div className="admin-grid-2">
        <AdminPanel subtitle="Team totals across the admin scope" title="Team Summary">
          <div className="admin-team-grid">
            {teams.map((team) => (
              <div className="admin-team-card" key={team.name}>
                <div className="admin-team-card-head">
                  <strong>{team.name}</strong>
                  <span>{team.leader}</span>
                </div>
                <div className="admin-team-card-body">
                  <div>
                    <span>Agents</span>
                    <strong>{team.agents.length}</strong>
                  </div>
                  <div>
                    <span>Handled</span>
                    <strong>{team.handledToday}</strong>
                  </div>
                  <div>
                    <span>Assigned</span>
                    <strong>{team.assignedTickets}</strong>
                  </div>
                  <div>
                    <span>Completed</span>
                    <strong>{team.completedToday}</strong>
                  </div>
                  <div>
                    <span>Warnings</span>
                    <strong>{team.warnings}</strong>
                  </div>
                  <div>
                    <span>Mistakes</span>
                    <strong>{team.mistakes}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>

        <div className="admin-stack">
          <AdminPanel subtitle="Most recent admin notices" title="Announcements">
            <div className="admin-compact-list">
              {announcements.map((item) => (
                <div className="admin-compact-row" key={`${item.title}-${item.date}`}>
                  <strong>{item.title}</strong>
                  <span>{item.target}</span>
                  <small>{item.date}</small>
                </div>
              ))}
            </div>
          </AdminPanel>
          <AdminPanel subtitle="Current disciplinary items" title="Recent Warnings">
            <div className="admin-compact-list">
              {warnings.length ? (
                warnings.map((item) => (
                  <div className="admin-compact-row" key={`${item.name}-${item.title}`}>
                    <strong>{item.name}</strong>
                    <span>
                      {item.team} | {item.title}
                    </span>
                    <small>{item.sentAt}</small>
                  </div>
                ))
              ) : (
                <div className="admin-empty-state">
                  <AlertTriangle size={18} />
                  No warnings recorded.
                </div>
              )}
            </div>
          </AdminPanel>
          <AdminPanel subtitle="Quality and handling issues" title="Recent Mistakes">
            <div className="admin-compact-list">
              {mistakes.length ? (
                mistakes.map((item) => (
                  <div className="admin-compact-row" key={`${item.name}-${item.title}`}>
                    <strong>{item.name}</strong>
                    <span>
                      {item.team} | {item.title}
                    </span>
                    <small>{item.sentAt}</small>
                  </div>
                ))
              ) : (
                <div className="admin-empty-state">
                  <AlertTriangle size={18} />
                  No mistakes recorded.
                </div>
              )}
            </div>
          </AdminPanel>
        </div>
      </div>

      <AdminPanel
        action={<Link className="admin-panel-link" href="/admin/activity-logs">View all logs</Link>}
        subtitle="Newest ER ticket audit entries first, with ticket rows used as fallback"
        title="Recent Activity"
      >
        <div className="admin-activity-list admin-activity-list--timeline">
          {activity.map((item) => (
            <button
              className="admin-activity-row admin-activity-row--dashboard"
              key={item.id}
              onClick={() => setSelectedActivity(item)}
              type="button"
            >
              <div className="admin-activity-pin" aria-hidden="true" />
              <div className="admin-activity-content">
                <div className="admin-activity-title-line">
                  <span className="admin-activity-badge">{item.badge}</span>
                  <strong>{item.title}</strong>
                </div>
                <p>{item.summary}</p>
                <div className="admin-activity-meta">
                  <span>{item.meta}</span>
                  <span>{item.actor}</span>
                </div>
              </div>
              <div className="admin-activity-row-actions">
                <time dateTime={item.createdAt}>{item.time}</time>
                <span>View details</span>
              </div>
            </button>
          ))}
          {!activity.length ? <div className="admin-empty-state">No recent ticket or audit activity yet.</div> : null}
        </div>
      </AdminPanel>

      {selectedActivity ? (
        <ActivityDetailModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} />
      ) : null}

      <div className="admin-grid-3 admin-grid-3--mini">
        <AdminPanel subtitle="ER location_mgmt_coverage" title="Cities">
          <div className="admin-link-card">
            <Building2 size={18} />
            <strong>{coverage.cities.toLocaleString()}</strong>
            <span>{coverage.zips.toLocaleString()} ZIPs across {coverage.locations.toLocaleString()} locations</span>
            <Link href="/admin/cities">Open ER cities</Link>
          </div>
        </AdminPanel>
        <AdminPanel subtitle="Customer profiles" title="Customers">
          <div className="admin-link-card">
            <Users size={18} />
            <strong>{overall.totalRequests}</strong>
            <span>ER customer-linked ticket records</span>
            <Link href="/admin/customers">Open customers</Link>
          </div>
        </AdminPanel>
        <AdminPanel subtitle="Catalog maintenance" title="Brands & Appliances">
          <div className="admin-link-card">
            <Tags size={18} />
            <strong>{topBrands.length + topAppliances.length}</strong>
            <span>Visible product categories</span>
            <div className="admin-inline-links">
              <Link href="/admin/brands">Brands</Link>
              <Link href="/admin/appliances">Appliances</Link>
            </div>
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
