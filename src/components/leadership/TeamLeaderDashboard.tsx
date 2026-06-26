'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ClipboardList,
  ClipboardPlus,
  Headphones,
  Mail,
  MessageSquare,
  Phone,
  Shield,
  TrendingUp,
  UserSquare2,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { buildCallActivity, buildTeamCards, getRequestBreakdown, teamLeaderRoster } from '@/components/leadership/dashboardData';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';

function Stat({ icon, label, value, tone = 'white' }: { icon: React.ReactNode; label: string; value: number | string; tone?: string }) {
  return (
    <div className={`manager-stat-card ${tone}`}>
      <div className="manager-stat-icon">{icon}</div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function EmptyPanel({ title, tone }: { title: string; tone: 'warning' | 'mistake' }) {
  return (
    <section className="manager-list-panel">
      <div className="manager-list-head">
        <h2><AlertTriangle size={16} /> {title}</h2>
        <span className={`manager-count ${tone}`}>0</span>
      </div>
      <div className="manager-filter-row">
        <select><option>All dates</option></select>
        <input placeholder="Search team / name / title" />
      </div>
      <div className="manager-empty-state">No {title.toLowerCase().replace('recent ', '')} match this filter.</div>
    </section>
  );
}

export function TeamLeaderDashboard() {
  const { profile } = useAuth();
  const { requests, error } = useLeadershipRequests();
  const teams = useMemo(() => buildTeamCards(requests), [requests]);
  const team = useMemo(() => teams.find((item) => item.leader.toLowerCase().includes('rochelle')) ?? teams[0], [teams]);
  const teamRequests = team?.requests ?? requests;
  const summary = useMemo(() => getRequestBreakdown(teamRequests), [teamRequests]);
  const callActivity = useMemo(() => buildCallActivity(teamRequests, teamLeaderRoster.map((member) => member.name)), [teamRequests]);
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Rochelle Ortiz';
  const maxCalls = Math.max(1, summary.total, summary.approved, summary.pending);

  return (
    <div className="manager-dashboard php-manager-page team-leader-page">
      <div className="manager-quick-actions">
        <Link className="btn btn-secondary" href="/team-leader/dashboard"><ClipboardList size={16} />Dashboard</Link>
        <Link className="btn btn-secondary" href="/team-leader/agents"><Users size={16} />Team Agents</Link>
        <Link className="btn btn-secondary" href="/team-leader/requests"><Users size={16} />Team Requests</Link>
        <Link className="btn btn-secondary" href="/team-leader/performance"><TrendingUp size={16} />Team Performance</Link>
        <Link className="btn btn-secondary" href="/team-leader/messages"><MessageSquare size={16} />Messages</Link>
        <Link className="btn btn-secondary" href="/team-leader/mistake"><AlertTriangle size={16} />Mistake</Link>
        <Link className="btn btn-secondary" href="/team-leader/warning"><AlertTriangle size={16} />Warning</Link>
      </div>

      <section className="agent-profile-panel php-tl-profile">
        <div className="leadership-panel-head">
          <div>
            <span className="agent-eyebrow">Profile</span>
            <h1>Welcome, {fullName}</h1>
          </div>
          <span className="leadership-badge">Team Leader Workspace</span>
        </div>
        <div className="agent-profile-grid">
          <div className="agent-info-card"><UserSquare2 size={18} /><span>Position</span><strong>Team Leader</strong></div>
          <div className="agent-info-card"><Mail size={18} /><span>Email</span><strong>{profile?.email || 'annortiz9192@gmail.com'}</strong></div>
          <div className="agent-info-card"><Phone size={18} /><span>Phone</span><strong>{profile?.phone_number || '--'}</strong></div>
          <div className="agent-info-card"><Users size={18} /><span>Last Login</span><strong>Jun 18, 2026 2:41 PM</strong></div>
        </div>
      </section>

      <section className="manager-table-panel">
        <div className="manager-table-headline subtle">
          <div>
            <h2>Team {fullName}</h2>
            <p>CSR agents that belong to this Team Leader</p>
          </div>
          <span>{teamLeaderRoster.length} Agents</span>
        </div>
        <div className="manager-table-wrap">
          <table className="manager-data-table">
            <thead><tr><th>CSR Agent</th><th>Email</th><th>Phone</th><th>Status</th><th>Recent Login</th></tr></thead>
            <tbody>
              {teamLeaderRoster.length ? teamLeaderRoster.map((member) => (
                <tr key={member.email}>
                  <td>{member.name}</td>
                  <td>{member.email}</td>
                  <td>{member.phone}</td>
                  <td><span className="manager-status approved">{member.status}</span></td>
                  <td>{member.lastLogin}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="manager-empty-cell">No CSR agents assigned to this team yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="manager-section">
        <h2>My Activity Today</h2>
        <div className="manager-stat-grid">
          <Stat icon={<Headphones size={19} />} label="Total Calls Handled" value={0} />
          <Stat icon={<Phone size={19} />} label="Inbound" value={0} tone="cyan" />
          <Stat icon={<Phone size={19} />} label="Outbound" value={0} tone="blue" />
          <Stat icon={<ClipboardPlus size={19} />} label="Manually Created Tickets" value={0} tone="green" />
          <Stat icon={<Shield size={19} />} label="Approved Tickets / Verified" value={0} tone="green" />
        </div>
      </section>

      <section className="manager-section">
        <h2>Team Activity Today</h2>
        <div className="manager-stat-grid">
          <Stat icon={<Headphones size={19} />} label="Total Calls Handled" value={summary.total} tone="green" />
          <Stat icon={<Phone size={19} />} label="Inbound" value={Math.ceil(summary.total * 0.65)} tone="cyan" />
          <Stat icon={<Phone size={19} />} label="Outbound" value={Math.floor(summary.total * 0.35)} tone="purple" />
          <Stat icon={<ClipboardPlus size={19} />} label="Manually Created Tickets" value={summary.manualTickets} tone="green" />
          <Stat icon={<Shield size={19} />} label="Approved Tickets / Verified" value={summary.approvedVerified} tone="green" />
        </div>
      </section>

      {error ? <div className="customer-alert">{error}</div> : null}

      <section className="manager-analytics-grid">
        <div className="manager-chart-panel">
          <h2>Team Performance</h2>
          <div className="manager-chart-legend"><span className="handled" /> Handled <span className="assigned" /> Assigned <span className="completed" /> Completed <span className="connected" /> Connected</div>
          <div className="manager-bar-chart compact">
            {['Handled', 'Assigned', 'Completed', 'Connected'].map((label, index) => (
              <div className="manager-bar-group" key={label}>
                <div className="manager-bars"><span className={index % 2 ? 'connected' : 'handled'} style={{ height: `${Math.max(12, ([summary.total, summary.pending, summary.approved, summary.approvedVerified][index] / maxCalls) * 150)}px` }} /></div>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="manager-chart-panel">
          <h2>Task Status</h2>
          <div className="manager-donut-wrap">
            <div className="manager-donut" style={{ background: 'conic-gradient(#facc15 0 35%, #22c55e 35% 55%, #06b6d4 55% 73%, #3b82f6 73% 88%, #ef4444 88% 100%)' }} />
            <div className="manager-donut-legend">
              <span><i className="new" /> New Request <b>{summary.pending}</b></span>
              <span><i className="assigned" /> Assigned <b>{Math.max(0, summary.total - summary.pending)}</b></span>
              <span><i className="progress" /> In Progress <b>0</b></span>
              <span><i className="completed" /> Repair Completed <b>{summary.approved}</b></span>
              <span><i className="cancelled" /> Cancelled <b>{summary.rejected}</b></span>
            </div>
          </div>
        </div>
      </section>

      <section className="manager-bottom-grid">
        <EmptyPanel title="Recent Mistakes" tone="mistake" />
        <EmptyPanel title="Recent Warnings" tone="warning" />
      </section>
    </div>
  );
}
