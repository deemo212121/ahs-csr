'use client';

import { ClipboardCheck } from 'lucide-react';
import { buildTeamCards, getRequestBreakdown } from '@/components/leadership/dashboardData';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';

export function ManagerReportPage() {
  const { requests, error } = useLeadershipRequests();
  const teams = buildTeamCards(requests);
  const summary = getRequestBreakdown(requests);

  return (
    <div className="agent-dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">CSR Daily Report</h1>
          <p className="muted">Manager summary across all tracked service requests.</p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <section className="agent-panel">
        <h2>Summary</h2>
        <div className="agent-stat-grid">
          <div className="agent-stat-card">
            <ClipboardCheck size={18} />
            <strong>{summary.total}</strong>
            <span>Total Requests</span>
          </div>
          <div className="agent-stat-card cyan">
            <ClipboardCheck size={18} />
            <strong>{summary.pending}</strong>
            <span>Pending</span>
          </div>
          <div className="agent-stat-card green">
            <ClipboardCheck size={18} />
            <strong>{summary.approved}</strong>
            <span>Approved</span>
          </div>
          <div className="agent-stat-card blue">
            <ClipboardCheck size={18} />
            <strong>{summary.rejected}</strong>
            <span>Rejected</span>
          </div>
          <div className="agent-stat-card green">
            <ClipboardCheck size={18} />
            <strong>{summary.approvedVerified}</strong>
            <span>Verified</span>
          </div>
        </div>
      </section>
      <section className="leadership-board-grid single">
        {teams.map((team) => (
          <div className="agent-table-panel" key={team.name}>
            <h2>{team.name}</h2>
            <div className="leadership-team-card-body">
              <div>
                <span>Leader</span>
                <strong>{team.leader}</strong>
              </div>
              <div>
                <span>Requests</span>
                <strong>{team.requests.length}</strong>
              </div>
              <div>
                <span>Approved</span>
                <strong>{team.approved}</strong>
              </div>
              <div>
                <span>Pending</span>
                <strong>{team.pending}</strong>
              </div>
              <div>
                <span>Rejected</span>
                <strong>{team.rejected}</strong>
              </div>
              <div>
                <span>Calls</span>
                <strong>{team.callsHandled}</strong>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
