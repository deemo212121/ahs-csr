'use client';

import { CalendarDays, ClipboardList, Headphones, Shield } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';
import { useStaffTeams } from '@/lib/staff/useStaffTeams';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import type { RtcCall, RtcCallListResponse } from '@/lib/calls/types';
import type { ServiceRequest } from '@/lib/types';
import {
  EmptyRow,
  TicketSummaryModal,
  CallSummaryModal,
  formatCallDuration,
  formatDateTime,
  isRestored,
  reviewedAt,
  ticketDisplayStatus,
  ticketNo,
  ticketNoteText,
  type TicketDisplayStatus,
} from '@/components/csr/CsrDashboard';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function withinRange(value: string | null | undefined, startIso: string, endIso: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  const start = new Date(`${startIso}T00:00:00`).getTime();
  const end = new Date(`${endIso}T23:59:59.999`).getTime();
  return time >= start && time <= end;
}

// Teams are defined by the Team Leader assignment (Team Management), not by
// branch/region. The API already scopes /api/staff/teams per role: a Team
// Leader only gets her own team back; a CSR Manager gets every team.
export function TeamActivityDashboard({
  groupByTeam = false,
  title = 'Total Team',
}: {
  groupByTeam?: boolean;
  title?: string;
}) {
  const { user } = useAuth();
  const { requests, loading, error } = useLeadershipRequests(1000);
  const { teams, loading: teamsLoading, error: teamsError } = useStaffTeams(user);

  const [calls, setCalls] = useState<RtcCall[]>([]);
  const [callsLoading, setCallsLoading] = useState(true);
  const [callsError, setCallsError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<ServiceRequest | null>(null);
  const [selectedCall, setSelectedCall] = useState<RtcCall | null>(null);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | TicketDisplayStatus>('all');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [teamFilter, setTeamFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');

  useEffect(() => {
    if (!user) return;
    const authUser = user;
    let cancelled = false;
    async function loadCalls() {
      setCallsLoading(true);
      setCallsError(null);
      try {
        const data = await fetchJsonWithFirebase<RtcCallListResponse>(authUser, '/api/calls?history=true&limit=1000');
        if (cancelled) return;
        if (data.setup_required) throw new Error(data.message || 'Web call queue setup is missing.');
        setCalls(data.calls);
      } catch (err) {
        if (!cancelled) setCallsError(err instanceof Error ? err.message : 'Unable to load call history.');
      } finally {
        if (!cancelled) setCallsLoading(false);
      }
    }
    void loadCalls();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const hasTeamsData = teams.length > 0;

  const allMemberIds = useMemo(() => new Set(teams.flatMap((team) => team.memberIds)), [teams]);
  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    teams.forEach((team) => Object.assign(map, team.memberNames));
    return map;
  }, [teams]);
  const allMemberNames = useMemo(() => new Set(Object.values(nameById)), [nameById]);

  const teamTickets = useMemo(
    () =>
      requests
        .filter((request) => {
          const reviewerId = request.verification_reviewed_by;
          const inScope = !hasTeamsData || (!!reviewerId && allMemberIds.has(reviewerId));
          const isDecided = request.verification_status === 'approved' || request.verification_status === 'rejected' || isRestored(request);
          return inScope && isDecided && !!reviewerId;
        })
        .sort((a, b) => new Date(reviewedAt(b) || 0).getTime() - new Date(reviewedAt(a) || 0).getTime()),
    [requests, hasTeamsData, allMemberIds],
  );

  const rangedTickets = useMemo(
    () => teamTickets.filter((request) => withinRange(reviewedAt(request), startDate, endDate)),
    [teamTickets, startDate, endDate],
  );

  const selectedTeam = useMemo(
    () => (teamFilter === 'all' ? null : teams.find((team) => team.leaderId === teamFilter) ?? null),
    [teams, teamFilter],
  );

  const agentOptions = useMemo(() => {
    const source = selectedTeam ? [selectedTeam] : teams;
    const options = new Map<string, string>();
    source.forEach((team) => Object.entries(team.memberNames).forEach(([id, name]) => options.set(id, name)));
    return Array.from(options.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [teams, selectedTeam]);

  useEffect(() => {
    if (agentFilter !== 'all' && !agentOptions.some(([id]) => id === agentFilter)) {
      setAgentFilter('all');
    }
  }, [agentOptions, agentFilter]);

  const agentFilterName = agentFilter === 'all' ? null : nameById[agentFilter] ?? null;

  const filteredTickets = useMemo(
    () =>
      rangedTickets.filter((request) => {
        if (ticketStatusFilter !== 'all' && ticketDisplayStatus(request) !== ticketStatusFilter) return false;
        const reviewerId = request.verification_reviewed_by || '';
        if (selectedTeam && !selectedTeam.memberIds.includes(reviewerId)) return false;
        if (agentFilter !== 'all' && reviewerId !== agentFilter) return false;
        return true;
      }),
    [rangedTickets, ticketStatusFilter, selectedTeam, agentFilter],
  );

  const teamCalls = useMemo(
    () =>
      calls
        .filter((call) => call.status === 'completed' && (!hasTeamsData || allMemberNames.has(call.accepted_by_name || '')))
        .sort((a, b) => new Date(b.queued_at || 0).getTime() - new Date(a.queued_at || 0).getTime()),
    [calls, hasTeamsData, allMemberNames],
  );

  const rangedCalls = useMemo(
    () =>
      teamCalls.filter((call) => {
        if (!withinRange(call.queued_at, startDate, endDate)) return false;
        const name = call.accepted_by_name || '';
        if (selectedTeam && !Object.values(selectedTeam.memberNames).includes(name)) return false;
        if (agentFilterName && name !== agentFilterName) return false;
        return true;
      }),
    [teamCalls, startDate, endDate, selectedTeam, agentFilterName],
  );

  const verifiedCount = rangedTickets.filter((request) => request.verification_status === 'approved').length;
  const rejectedCount = rangedTickets.filter((request) => request.verification_status === 'rejected').length;
  const callsAnsweredCount = rangedCalls.length;

  const teamBreakdown = useMemo(() => {
    if (!groupByTeam) return [];
    return teams.map((team) => {
      const memberIdSet = new Set(team.memberIds);
      const memberNameSet = new Set(Object.values(team.memberNames));
      return {
        leaderId: team.leaderId,
        leaderName: team.leaderName,
        verified: rangedTickets.filter((request) => request.verification_status === 'approved' && !!request.verification_reviewed_by && memberIdSet.has(request.verification_reviewed_by)).length,
        rejected: rangedTickets.filter((request) => request.verification_status === 'rejected' && !!request.verification_reviewed_by && memberIdSet.has(request.verification_reviewed_by)).length,
        callsAnswered: rangedCalls.filter((call) => memberNameSet.has(call.accepted_by_name || '')).length,
      };
    });
  }, [groupByTeam, teams, rangedTickets, rangedCalls]);

  const isSingleDay = startDate === endDate;
  const rangeLabel = isSingleDay
    ? (startDate === todayIso() ? 'Today' : formatDateTime(startDate).split(',')[0])
    : `${startDate} to ${endDate}`;

  return (
    <div className="agent-dashboard csr-dashboard-upgraded">
      <section className="agent-panel">
        <div className="csr-verified-panel-head">
          <h2><CalendarDays size={16} /> Date Range</h2>
          <div className="tl-date-range">
            <label>
              Start
              <input max={endDate} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
            </label>
            <label>
              End
              <input min={startDate} max={todayIso()} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
            </label>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setStartDate(todayIso());
                setEndDate(todayIso());
              }}
              type="button"
            >
              Today
            </button>
          </div>
        </div>
      </section>

      <section className="agent-panel">
        <h2>{title} — {rangeLabel}</h2>
        <div className="agent-stat-grid csr-agent-stat-grid">
          <div className="agent-stat-card cyan">
            <Shield size={18} />
            <strong>{verifiedCount}</strong>
            <span>Verified</span>
          </div>
          <div className="agent-stat-card">
            <ClipboardList size={18} />
            <strong>{rejectedCount}</strong>
            <span>Rejected</span>
          </div>
          <div className="agent-stat-card green">
            <Headphones size={18} />
            <strong>{callsAnsweredCount}</strong>
            <span>Calls Answered</span>
          </div>
        </div>
      </section>

      {groupByTeam ? (
        <section className="agent-panel">
          <h2>All Teams — {rangeLabel}</h2>
          <div className="tl-team-breakdown-grid">
            {teamBreakdown.map((team) => (
              <div className="tl-team-breakdown-card" key={team.leaderId}>
                <strong>{team.leaderName}</strong>
                <div>
                  <span>Verified <b>{team.verified}</b></span>
                  <span>Rejected <b>{team.rejected}</b></span>
                  <span>Calls <b>{team.callsAnswered}</b></span>
                </div>
              </div>
            ))}
            {!teamBreakdown.length && !teamsLoading ? <em>No teams configured yet. Assign CSR agents in Team Management.</em> : null}
          </div>
        </section>
      ) : null}

      {groupByTeam ? (
        <section className="agent-panel">
          <h2>Filter Verified Tickets / Web Calls Handled</h2>
          <div className="tl-table-filter-row">
            <label>
              Team
              <select
                onChange={(event) => setTeamFilter(event.target.value)}
                value={teamFilter}
              >
                <option value="all">All Teams</option>
                {teams.map((team) => (
                  <option key={team.leaderId} value={team.leaderId}>{team.leaderName}</option>
                ))}
              </select>
            </label>
            <label>
              Agent
              <select
                onChange={(event) => setAgentFilter(event.target.value)}
                value={agentFilter}
              >
                <option value="all">All Agents</option>
                {agentOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      ) : null}

      {error ? <div className="customer-alert">{error}</div> : null}
      {teamsError ? <div className="customer-alert">{teamsError}</div> : null}
      {loading || teamsLoading ? <div className="customer-alert">Loading team verification history...</div> : null}
      {callsError ? <div className="customer-alert">{callsError}</div> : null}

      <section className="agent-dashboard-grid csr-dashboard-grid-redesigned">
        <div className="agent-table-panel csr-verified-panel">
          <div className="csr-verified-panel-head">
            <h2>
              <ClipboardList size={16} />
              Number of Verified Tickets
            </h2>
            <div className="csr-status-filter">
              {(['all', 'approved', 'rejected', 'restored'] as const).map((option) => (
                <button
                  className={`csr-status-filter-btn ${ticketStatusFilter === option ? 'active' : ''}`}
                  key={option}
                  onClick={() => setTicketStatusFilter(option)}
                  type="button"
                >
                  {option === 'all' ? 'All' : option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="agent-table-head seven">
            <span>Date</span>
            <span>Ticket #</span>
            <span>Name of CSR</span>
            <span>Name of CX</span>
            <span>Branch/Region</span>
            <span>Status</span>
            <span>Notes</span>
          </div>
          {filteredTickets.length ? (
            <div className="agent-table-body">
              {filteredTickets.map((request) => {
                const displayStatus = ticketDisplayStatus(request);
                return (
                  <button
                    className="agent-table-row seven csr-clickable-row"
                    key={request.id}
                    onClick={() => setSelectedTicket(request)}
                    type="button"
                  >
                    <span>{formatDateTime(reviewedAt(request))}</span>
                    <strong>{ticketNo(request)}</strong>
                    <span>{(request.verification_reviewed_by && nameById[request.verification_reviewed_by]) || '—'}</span>
                    <span>{request.full_name || '—'}</span>
                    <span>{request.region || '—'}</span>
                    <span className={`agent-pill ${displayStatus}`}>{displayStatus}</span>
                    <span>{ticketNoteText(request, displayStatus)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyRow label="No verified ticket activity found in the selected range." />
          )}
        </div>
        <div className="agent-table-panel csr-calls-panel">
          <h2>
            <Headphones size={16} />
            Web Calls Handled
          </h2>
          <div className="agent-table-head seven">
            <span>Date</span>
            <span>Name of CSR</span>
            <span>Name of CX</span>
            <span>Branch/Region</span>
            <span>Status</span>
            <span>Duration</span>
            <span>Notes</span>
          </div>
          {callsLoading ? (
            <EmptyRow label="Loading call history..." />
          ) : rangedCalls.length ? (
            <div className="agent-table-body">
              {rangedCalls.map((call) => (
                <button
                  className="agent-table-row seven csr-clickable-row"
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  type="button"
                >
                  <span>{formatDateTime(call.queued_at)}</span>
                  <strong>{call.accepted_by_name || '—'}</strong>
                  <span>{call.customer_name}</span>
                  <span>{call.branch || '—'}</span>
                  <span className="agent-pill completed">{call.status}</span>
                  <span>{formatCallDuration(call.call_duration_seconds)}</span>
                  <span>{call.notes || '—'}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyRow label="No web calls answered in the selected range." />
          )}
        </div>
      </section>

      {selectedTicket ? <TicketSummaryModal request={selectedTicket} onClose={() => setSelectedTicket(null)} /> : null}
      {selectedCall ? (
        <CallSummaryModal
          call={selectedCall}
          user={user}
          onClose={() => setSelectedCall(null)}
          onNoteSaved={(updated) => {
            setCalls((current) => current.map((call) => (call.id === updated.id ? updated : call)));
            setSelectedCall(updated);
          }}
        />
      ) : null}
    </div>
  );
}
