'use client';

import { TrendingUp } from 'lucide-react';
import { buildTeamCards } from '@/components/leadership/dashboardData';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';

export function TeamPerformancePage() {
  const { requests, error } = useLeadershipRequests();
  const teams = buildTeamCards(requests);

  return (
    <div className="agent-dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Performance</h1>
          <p className="muted">Current request and verification breakdown by team.</p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <section className="leadership-board-grid single">
        {teams.map((team) => (
          <div className="agent-table-panel" key={team.name}>
            <h2>
              <TrendingUp size={16} />
              {team.name}
            </h2>
            <div className="leadership-team-card-body">
              <div>
                <span>Assigned Leader</span>
                <strong>{team.leader}</strong>
              </div>
              <div>
                <span>Agents</span>
                <strong>{team.agents.length}</strong>
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
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

