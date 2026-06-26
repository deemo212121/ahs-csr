'use client';

import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Hash,
  Headphones,
  Mail,
  Phone,
  RefreshCw,
  Shield,
  UserSquare2,
} from 'lucide-react';
import { useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';
import { erStatusText } from '@/components/erTicketFilters';
import type { ServiceRequest } from '@/lib/types';

const callActivity = [
  { customer: 'Bubble Max / Decatur', status: 'completed', duration: '00:12', date: 'Jun 15, 2026 4:29 PM' },
  { customer: 'Bubble Max / Decatur', status: 'completed', duration: '00:29', date: 'Jun 15, 2026 4:11 PM' },
  { customer: 'Mitch Modelo / Test address', status: 'completed', duration: '00:19', date: 'Jun 15, 2026 4:07 PM' },
];

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="agent-empty-row">
      <span>{label}</span>
    </div>
  );
}

function ticketNo(request: ServiceRequest) {
  return request.er_ticket?.ticket_no || request.request_number || '—';
}

function lastHandledAt(request: ServiceRequest) {
  return (
    request.handled_last_activity_at ||
    request.er_ticket?.status_changed_at ||
    request.er_ticket?.updated_at ||
    request.updated_at ||
    request.requested_at
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function isToday(value?: string | null) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  return parsed.getFullYear() === now.getFullYear() && parsed.getMonth() === now.getMonth() && parsed.getDate() === now.getDate();
}

function isOpenStatus(request: ServiceRequest) {
  const status = erStatusText(request).toLowerCase();
  return !['closed', 'complete', 'completed', 'cancel', 'cancelled', 'canceled', 'cl-data-closed'].some((word) => status.includes(word));
}

function changeSummary(request: ServiceRequest) {
  const field = request.handled_last_field || request.handled_last_action || 'ticket';
  const before = request.handled_last_before || 'blank';
  const after = request.handled_last_after || erStatusText(request);
  if (!request.handled_last_action && !request.handled_last_field) return 'Last ticket update by this CSR';
  return `${field.replace(/_/g, ' ')}: ${before} → ${after}`;
}

function branchChips(value?: string | null) {
  const branches = (value || '')
    .split('|')
    .map((branch) => branch.trim())
    .filter(Boolean)
    .slice(0, 5);

  return branches.length ? branches : ['ER profile branch filter'];
}

function TicketNumberCloud({ title, subtitle, tickets }: { title: string; subtitle: string; tickets: ServiceRequest[] }) {
  return (
    <div className="csr-ticket-number-card">
      <div className="csr-ticket-number-head">
        <div>
          <span>{title}</span>
          <strong>{tickets.length}</strong>
          <p>{subtitle}</p>
        </div>
        <Hash size={20} />
      </div>
      <div className="csr-ticket-number-list">
        {tickets.length ? (
          tickets.slice(0, 18).map((request) => <span key={`${request.id}-${ticketNo(request)}`}>{ticketNo(request)}</span>)
        ) : (
          <em>No handled ticket numbers yet.</em>
        )}
      </div>
    </div>
  );
}

export function CsrDashboard() {
  const { profile } = useAuth();
  const { requests, loading, error, refresh } = useLeadershipRequests(500, 'view=tickets');

  const handledTickets = useMemo(
    () => requests.filter((request) => request.handled_by_current_user),
    [requests],
  );

  const sortedHandledTickets = useMemo(
    () => [...handledTickets].sort((a, b) => new Date(lastHandledAt(b) || 0).getTime() - new Date(lastHandledAt(a) || 0).getTime()),
    [handledTickets],
  );

  const todayHandledTickets = useMemo(
    () => sortedHandledTickets.filter((request) => isToday(lastHandledAt(request))),
    [sortedHandledTickets],
  );

  const activeHandled = handledTickets.filter(isOpenStatus).length;
  const scheduledHandled = handledTickets.filter((request) => request.er_ticket?.schedule_date || request.preferred_date).length;
  const totalUpdates = handledTickets.reduce((sum, request) => sum + (request.handled_activity_count ?? 0), 0);
  const todayUpdates = todayHandledTickets.reduce((sum, request) => sum + (request.handled_activity_count ?? 0), 0);
  const recentTickets = sortedHandledTickets.slice(0, 5);

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'CSR Agent';
  const profileBranches = branchChips(profile?.region || profile?.city || null);

  return (
    <div className="agent-dashboard csr-dashboard-upgraded">
      <section className="agent-profile-panel">
        <span className="agent-eyebrow">Profile</span>
        <h1>Welcome, {fullName}</h1>
        <div className="agent-profile-grid">
          <div className="agent-info-card">
            <UserSquare2 size={18} />
            <span>Position</span>
            <strong>CSR Agent</strong>
          </div>
          <div className="agent-info-card">
            <Mail size={18} />
            <span>Email</span>
            <strong>{profile?.email || 'No email found'}</strong>
          </div>
          <div className="agent-info-card">
            <Phone size={18} />
            <span>Phone</span>
            <strong>{profile?.phone_number || '--'}</strong>
          </div>
          <div className="agent-info-card">
            <Activity size={18} />
            <span>Handled Source</span>
            <strong>ER Audit Logs</strong>
          </div>
        </div>
        <div className="agent-region-row">
          {profileBranches.map((branch) => <span key={branch}>{branch}</span>)}
        </div>
        <p className="agent-help-text">
          Handled tickets are based first on ER ticket_audit_log.changed_by matching this CSR profile, with tickets.status_changed_by as fallback.
        </p>
      </section>

      <section className="agent-panel csr-ticket-number-section">
        <div className="csr-section-title-row">
          <div>
            <h2><ClipboardList size={17} /> My Handled Ticket Numbers</h2>
            <p>Dashboard numbers below only count tickets this CSR handled.</p>
          </div>
          <button className="btn btn-secondary csr-soft-refresh" onClick={() => void refresh()} type="button">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
        <div className="csr-ticket-number-grid">
          <TicketNumberCloud title="Overall Handled" subtitle="All ticket numbers touched by this CSR" tickets={sortedHandledTickets} />
          <TicketNumberCloud title="Handled Today" subtitle="Ticket numbers updated today by this CSR" tickets={todayHandledTickets} />
        </div>
      </section>

      <section className="agent-panel">
        <h2>My Activity Today</h2>
        <div className="agent-stat-grid csr-agent-stat-grid">
          <div className="agent-stat-card cyan">
            <Shield size={18} />
            <strong>{todayHandledTickets.length}</strong>
            <span>Tickets Handled Today</span>
          </div>
          <div className="agent-stat-card blue">
            <ClipboardList size={18} />
            <strong>{handledTickets.length}</strong>
            <span>Overall Handled Tickets</span>
          </div>
          <div className="agent-stat-card green">
            <CalendarDays size={18} />
            <strong>{scheduledHandled}</strong>
            <span>Handled With Schedule</span>
          </div>
          <div className="agent-stat-card">
            <Activity size={18} />
            <strong>{todayUpdates || totalUpdates}</strong>
            <span>{todayUpdates ? 'Updates By Me Today' : 'Total Updates By Me'}</span>
          </div>
          <div className="agent-stat-card green">
            <Headphones size={18} />
            <strong>{callActivity.length}</strong>
            <span>Total Calls Handled</span>
          </div>
        </div>
      </section>

      {error ? <div className="customer-alert">{error}</div> : null}
      {loading ? <div className="customer-alert">Loading CSR handled tickets from ER...</div> : null}

      <section className="agent-dashboard-grid">
        <div className="agent-table-panel">
          <h2>
            <AlertTriangle size={16} />
            My Recent Warnings
          </h2>
          <div className="agent-table-head five">
            <span>Date</span>
            <span>From</span>
            <span>Title</span>
            <span>Level</span>
            <span>Status</span>
          </div>
          <EmptyRow label="No warnings recorded." />
        </div>
        <div className="agent-table-panel">
          <h2>
            <AlertTriangle size={16} />
            My Recent Mistakes
          </h2>
          <div className="agent-table-head five">
            <span>Date</span>
            <span>From</span>
            <span>Title</span>
            <span>Level</span>
            <span>Status</span>
          </div>
          <EmptyRow label="No mistakes recorded." />
        </div>
        <div className="agent-table-panel csr-recent-ticket-panel">
          <h2>My Recent Handled Tickets</h2>
          <div className="agent-table-head five">
            <span>Date / Time</span>
            <span>Ticket #</span>
            <span>Status</span>
            <span>Updates</span>
            <span>Latest Change</span>
          </div>
          {recentTickets.length ? (
            <div className="agent-table-body">
              {recentTickets.map((request) => (
                <div className="agent-table-row five" key={request.id}>
                  <span>{formatDateTime(lastHandledAt(request))}</span>
                  <strong>{ticketNo(request)}</strong>
                  <span className="agent-pill approved">{erStatusText(request)}</span>
                  <span>{request.handled_activity_count || 1}</span>
                  <span>{changeSummary(request)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyRow label="No handled ticket activity found for this CSR yet." />
          )}
        </div>
        <div className="agent-table-panel">
          <h2>My Recent Call Activity</h2>
          <div className="agent-table-head four">
            <span>Date</span>
            <span>Customer / City</span>
            <span>Status</span>
            <span>Duration</span>
          </div>
          <div className="agent-table-body">
            {callActivity.map((call) => (
              <div className="agent-table-row four" key={`${call.customer}-${call.date}`}>
                <span>{call.date}</span>
                <strong>{call.customer}</strong>
                <span className="agent-pill approved">{call.status}</span>
                <span>{call.duration}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
