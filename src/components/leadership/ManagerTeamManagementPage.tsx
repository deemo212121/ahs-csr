'use client';

import { GripVertical, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';

type TeamLeaderOption = { id: string; name: string; email: string };
type CsrAgentRow = { id: string; name: string; email: string; branch: string | null; team_leader_id: string | null };

type TeamManagementResponse = {
  teamLeaders: TeamLeaderOption[];
  csrAgents: CsrAgentRow[];
};

const UNASSIGNED = 'unassigned';

export function ManagerTeamManagementPage() {
  const { user } = useAuth();
  const [teamLeaders, setTeamLeaders] = useState<TeamLeaderOption[]>([]);
  const [csrAgents, setCsrAgents] = useState<CsrAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragAgentId, setDragAgentId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJsonWithFirebase<TeamManagementResponse>(user, '/api/admin/team-management');
      setTeamLeaders(data.teamLeaders);
      setCsrAgents(data.csrAgents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load team management data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [user]);

  const groups = useMemo(() => {
    const byLeader = new Map<string, CsrAgentRow[]>();
    byLeader.set(UNASSIGNED, []);
    teamLeaders.forEach((leader) => byLeader.set(leader.id, []));
    csrAgents.forEach((agent) => {
      const key = agent.team_leader_id && byLeader.has(agent.team_leader_id) ? agent.team_leader_id : UNASSIGNED;
      byLeader.get(key)!.push(agent);
    });
    return byLeader;
  }, [teamLeaders, csrAgents]);

  async function assignAgent(agentId: string, teamLeaderId: string | null) {
    if (!user) return;
    const previous = csrAgents;
    setCsrAgents((current) => current.map((agent) => (agent.id === agentId ? { ...agent, team_leader_id: teamLeaderId } : agent)));
    setSavingId(agentId);
    try {
      await fetchJsonWithFirebase(user, '/api/admin/team-management', {
        method: 'PATCH',
        body: JSON.stringify({ csr_id: agentId, team_leader_id: teamLeaderId }),
      });
    } catch (err) {
      setCsrAgents(previous);
      setError(err instanceof Error ? err.message : 'Unable to update team assignment.');
    } finally {
      setSavingId(null);
    }
  }

  function onDrop(event: React.DragEvent, containerKey: string) {
    event.preventDefault();
    setDragOverKey(null);
    const agentId = event.dataTransfer.getData('text/plain') || dragAgentId;
    if (!agentId) return;
    void assignAgent(agentId, containerKey === UNASSIGNED ? null : containerKey);
    setDragAgentId(null);
  }

  return (
    <div className="agent-dashboard csr-dashboard-upgraded">
      <section className="agent-panel">
        <h2><Users size={16} /> Team Management</h2>
        <p className="agent-help-text">Drag a CSR agent card into a Team Leader's container to assign their team. Changes save automatically.</p>
      </section>

      {error ? <div className="customer-alert">{error}</div> : null}
      {loading ? <div className="customer-alert">Loading CSR agent accounts...</div> : null}

      <section className="tl-team-mgmt-grid">
        <div
          className={`tl-team-mgmt-container ${dragOverKey === UNASSIGNED ? 'drag-over' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setDragOverKey(UNASSIGNED); }}
          onDragLeave={() => setDragOverKey((current) => (current === UNASSIGNED ? null : current))}
          onDrop={(event) => onDrop(event, UNASSIGNED)}
        >
          <div className="tl-team-mgmt-head">
            <strong>Unassigned CSR Agents</strong>
            <span>{groups.get(UNASSIGNED)?.length ?? 0}</span>
          </div>
          <div className="tl-team-mgmt-cards">
            {(groups.get(UNASSIGNED) ?? []).map((agent) => (
              <div
                className={`tl-agent-card ${savingId === agent.id ? 'saving' : ''}`}
                draggable
                key={agent.id}
                onDragEnd={() => setDragAgentId(null)}
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', agent.id);
                  setDragAgentId(agent.id);
                }}
              >
                <GripVertical size={14} />
                <div>
                  <strong>{agent.name}</strong>
                  <small>{agent.branch || 'No branch'}</small>
                </div>
              </div>
            ))}
            {!(groups.get(UNASSIGNED) ?? []).length ? <em>No unassigned CSR agents.</em> : null}
          </div>
        </div>

        {teamLeaders.map((leader) => (
          <div
            className={`tl-team-mgmt-container ${dragOverKey === leader.id ? 'drag-over' : ''}`}
            key={leader.id}
            onDragOver={(event) => { event.preventDefault(); setDragOverKey(leader.id); }}
            onDragLeave={() => setDragOverKey((current) => (current === leader.id ? null : current))}
            onDrop={(event) => onDrop(event, leader.id)}
          >
            <div className="tl-team-mgmt-head">
              <strong>{leader.name}</strong>
              <span>{groups.get(leader.id)?.length ?? 0}</span>
            </div>
            <div className="tl-team-mgmt-cards">
              {(groups.get(leader.id) ?? []).map((agent) => (
                <div
                  className={`tl-agent-card ${savingId === agent.id ? 'saving' : ''}`}
                  draggable
                  key={agent.id}
                  onDragEnd={() => setDragAgentId(null)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', agent.id);
                    setDragAgentId(agent.id);
                  }}
                >
                  <GripVertical size={14} />
                  <div>
                    <strong>{agent.name}</strong>
                    <small>{agent.branch || 'No branch'}</small>
                  </div>
                </div>
              ))}
              {!(groups.get(leader.id) ?? []).length ? <em>Drop CSR agents here.</em> : null}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
