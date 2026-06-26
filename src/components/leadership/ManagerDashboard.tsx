'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  MessageSquare,
  Phone,
  RefreshCw,
  Shield,
  Ticket,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { buildTeamCards, getRequestBreakdown, type StaffProfileForTeams, type TeamCardData } from '@/components/leadership/dashboardData';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';
import { fetchJsonWithFirebase } from '@/lib/auth/client';

type ManagerStatProps = {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: 'cyan' | 'green' | 'purple' | 'yellow' | 'red' | 'white';
};

type StaffResponse = {
  staff?: StaffProfileForTeams[];
  message?: string;
};

type TeamMetricKey = 'callsHandled' | 'todayTickets' | 'manualTickets' | 'completedTickets';

const teamMetricLines: Array<{ key: TeamMetricKey; label: string; color: string }> = [
  { key: 'callsHandled', label: 'Total tickets', color: '#60a5fa' },
  { key: 'todayTickets', label: 'Today', color: '#a78bfa' },
  { key: 'manualTickets', label: 'Manual', color: '#22c55e' },
  { key: 'completedTickets', label: 'Completed', color: '#14b8a6' },
];

function ManagerStat({ icon, label, value, tone = 'white' }: ManagerStatProps) {
  return (
    <div className={`manager-stat-card ${tone}`}>
      <div className="manager-stat-icon">{icon}</div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function EmptyManagerBox({ title, tone }: { title: string; tone: 'warning' | 'mistake' }) {
  return (
    <section className="manager-list-panel">
      <div className="manager-list-head">
        <h2>
          <AlertTriangle size={16} />
          {title}
        </h2>
        <span className={`manager-count ${tone}`}>0</span>
      </div>
      <div className="manager-filter-row">
        <select>
          <option>All dates</option>
        </select>
        <input placeholder="Search team / name / title" />
      </div>
      <div className="manager-empty-state">No {title.toLowerCase().replace('recent ', '')} match this filter.</div>
    </section>
  );
}

function statHeight(value: number, max: number) {
  if (value <= 0) return 6;
  return Math.max(12, (value / Math.max(1, max)) * 150);
}

function donutBackground(parts: Array<{ value: number; color: string }>) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  if (!total) return 'conic-gradient(rgba(148, 163, 184, 0.24) 0 100%)';

  let cursor = 0;
  const segments = parts
    .filter((part) => part.value > 0)
    .map((part) => {
      const start = cursor;
      const end = cursor + (part.value / total) * 100;
      cursor = end;
      return `${part.color} ${start}% ${end}%`;
    });

  return `conic-gradient(${segments.join(', ')})`;
}

function teamSortScore(team: TeamCardData) {
  return (team.callsHandled * 1000) + (team.todayTickets * 100) + (team.openTickets * 10) + team.agents.length;
}

function TeamPerformanceCard({ team, index, mode = 'dashboard' }: { team: TeamCardData; index: number; mode?: 'dashboard' | 'modal' }) {
  const agentLimit = mode === 'modal' ? 8 : 5;

  return (
    <div className={`manager-team-card tone-${index % 4} ${mode === 'modal' ? 'modal-team-card' : ''}`}>
      <div className="manager-team-head">
        <div>
          <strong>{team.name}</strong>
          <small>{team.regions.length ? `${team.regions.length} branch matches` : 'No ER branch mapped'}</small>
        </div>
        <button type="button">Live team</button>
      </div>
      <div className="manager-team-lines">
        <span>Agents <b>{team.agents.length}</b></span>
        <span>Total Tickets <b>{team.callsHandled}</b></span>
        <span>Today <b>{team.todayTickets}</b></span>
        <span>Customer / Online <b>{team.customerTickets}</b></span>
        <span>Manually Created Tickets <b>{team.manualTickets}</b></span>
        <span>Open / Active <b>{team.openTickets}</b></span>
        <span>Completed / Closed <b>{team.completedTickets}</b></span>
      </div>
      <div className="manager-team-agents">
        {team.agents.slice(0, agentLimit).map((agent) => (
          <span key={`${team.name}-${agent.name}-${agent.email}`}>
            <b>{agent.name}</b>
            <small>{agent.role || 'Staff'} · {agent.branch || 'No branch'}</small>
          </span>
        ))}
        {!team.agents.length ? <em>No ER agents mapped to this team yet.</em> : null}
        {team.agents.length > agentLimit ? <em>+{team.agents.length - agentLimit} more agents</em> : null}
      </div>
    </div>
  );
}

function TeamPerformanceLineGraph({ teams, maxTickets }: { teams: TeamCardData[]; maxTickets: number }) {
  const chartWidth = Math.max(960, teams.length * 92);
  const chartHeight = 330;
  const left = 54;
  const right = 30;
  const top = 28;
  const bottom = 86;
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const safeMax = Math.max(1, maxTickets);
  const xFor = (index: number) => left + (teams.length <= 1 ? plotWidth / 2 : (plotWidth / (teams.length - 1)) * index);
  const yFor = (value: number) => top + plotHeight - (Math.max(0, value) / safeMax) * plotHeight;
  const gridValues = [safeMax, Math.round(safeMax * 0.75), Math.round(safeMax * 0.5), Math.round(safeMax * 0.25), 0];

  return (
    <section className="manager-performance-line-card">
      <div className="manager-performance-line-head">
        <div>
          <h3>All team trend view</h3>
          <p>Compare every team across total, today, manual, and completed tickets.</p>
        </div>
        <div className="manager-performance-line-legend">
          {teamMetricLines.map((metric) => (
            <span key={metric.key}><i style={{ background: metric.color }} /> {metric.label}</span>
          ))}
        </div>
      </div>
      <div className="manager-performance-line-scroll">
        <svg className="manager-performance-line-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="All team ticket performance line graph">
          <defs>
            <linearGradient id="teamLineGraphFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(96, 165, 250, 0.14)" />
              <stop offset="100%" stopColor="rgba(96, 165, 250, 0)" />
            </linearGradient>
          </defs>

          {gridValues.map((value, index) => {
            const y = yFor(value);
            return (
              <g key={`grid-${index}`}>
                <line className="manager-line-grid" x1={left} x2={chartWidth - right} y1={y} y2={y} />
                <text className="manager-line-axis" x={left - 14} y={y + 4} textAnchor="end">{value}</text>
              </g>
            );
          })}

          <line className="manager-line-axis-line" x1={left} x2={chartWidth - right} y1={chartHeight - bottom} y2={chartHeight - bottom} />
          <line className="manager-line-axis-line" x1={left} x2={left} y1={top} y2={chartHeight - bottom} />

          {teamMetricLines.map((metric) => {
            const points = teams.map((team, index) => ({
              x: xFor(index),
              y: yFor(team[metric.key]),
              value: team[metric.key],
              label: team.leader,
            }));
            const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
            const areaPath = `${path} L ${points[points.length - 1]?.x ?? left} ${chartHeight - bottom} L ${points[0]?.x ?? left} ${chartHeight - bottom} Z`;

            return (
              <g key={metric.key}>
                {metric.key === 'callsHandled' ? <path className="manager-line-area" d={areaPath} /> : null}
                <path className="manager-line-path" d={path} style={{ stroke: metric.color }} />
                {points.map((point, index) => (
                  <circle
                    className="manager-line-point"
                    cx={point.x}
                    cy={point.y}
                    key={`${metric.key}-${point.label}-${index}`}
                    r={metric.key === 'callsHandled' ? 4 : 3}
                    style={{ fill: metric.color }}
                  >
                    <title>{point.label}: {point.value} {metric.label}</title>
                  </circle>
                ))}
              </g>
            );
          })}

          {teams.map((team, index) => (
            <g key={`label-${team.name}`}>
              <text className="manager-line-team-label" textAnchor="end" transform={`translate(${xFor(index) + 4} ${chartHeight - 42}) rotate(-38)`}>
                {team.leader}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function TeamPerformanceModal({
  teams,
  maxTickets,
  onClose,
}: {
  teams: TeamCardData[];
  maxTickets: number;
  onClose: () => void;
}) {
  return (
    <div className="manager-performance-modal-backdrop" onClick={onClose} role="presentation">
      <div className="manager-performance-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="team-performance-modal-title">
        <header>
          <div>
            <span className="manager-modal-eyebrow"><UsersRound size={15} /> All ER Teams</span>
            <h2 id="team-performance-modal-title">Team Ticket Performance</h2>
            <p>Every ER team built from manager name, branch access, assigned branch, and work-plan coverage.</p>
          </div>
          <button aria-label="Close team performance" onClick={onClose} type="button"><X size={18} /></button>
        </header>

        <div className="manager-performance-modal-body">
          <TeamPerformanceLineGraph teams={teams} maxTickets={maxTickets} />
          <div className="manager-performance-modal-grid">
            {teams.map((team, index) => (
              <TeamPerformanceCard key={`modal-card-${team.name}`} team={team} index={index} mode="modal" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ManagerDashboard() {
  const { user } = useAuth();
  const { requests, error, refresh } = useLeadershipRequests(1000, 'view=tickets');
  const [staff, setStaff] = useState<StaffProfileForTeams[]>([]);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false);

  const teams = useMemo(() => buildTeamCards(requests, staff), [requests, staff]);
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => teamSortScore(b) - teamSortScore(a) || a.leader.localeCompare(b.leader)), [teams]);
  const previewTeams = useMemo(() => sortedTeams.slice(0, 6), [sortedTeams]);
  const dashboardTeams = useMemo(() => sortedTeams.slice(0, 4), [sortedTeams]);
  const summary = useMemo(() => getRequestBreakdown(requests), [requests]);
  const maxTickets = Math.max(
    1,
    ...sortedTeams.map((team) => team.callsHandled),
    ...sortedTeams.map((team) => team.todayTickets),
    ...sortedTeams.map((team) => team.manualTickets),
    ...sortedTeams.map((team) => team.completedTickets),
  );

  const assigned = summary.assignedTickets;
  const inProgress = summary.inProgressTickets;
  const completed = summary.completedTickets;
  const cancelled = summary.cancelledTickets;
  const newRequests = Math.max(0, summary.openTickets - assigned - inProgress);
  const donut = donutBackground([
    { value: newRequests, color: '#facc15' },
    { value: assigned, color: '#14b8a6' },
    { value: inProgress, color: '#3b82f6' },
    { value: completed, color: '#22c55e' },
    { value: cancelled, color: '#ef4444' },
  ]);

  useEffect(() => {
    if (!user) {
      setStaff([]);
      setStaffError(null);
      return;
    }

    const authUser = user;
    let mounted = true;

    async function loadStaff() {
      try {
        const data = await fetchJsonWithFirebase<StaffResponse>(authUser, '/api/admin/catalogs?type=staff', { cache: 'no-store' });
        if (mounted) {
          setStaff(data.staff ?? []);
          setStaffError(null);
        }
      } catch (err) {
        if (mounted) {
          setStaff([]);
          setStaffError(err instanceof Error ? err.message : 'Unable to load ER team profiles.');
        }
      }
    }

    void loadStaff();
    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <div className="manager-dashboard php-manager-page">
      <div className="manager-quick-actions">
        <Link className="btn btn-primary" href="/manager/dashboard">
          <ArrowLeft size={16} /> Back
        </Link>
        <Link className="btn btn-secondary" href="/manager/tickets"><Ticket size={16} />Tickets</Link>
        <Link className="btn btn-secondary" href="/manager/calls"><Phone size={16} />Calls</Link>
        <Link className="btn btn-secondary" href="/manager/messages"><MessageSquare size={16} />Messages</Link>
        <Link className="btn btn-secondary" href="/manager/activity-logs"><ClipboardList size={16} />Activity Logs</Link>
        <Link className="btn btn-secondary" href="/manager/manual"><ClipboardPlus size={16} />Manual Ticket</Link>
        <Link className="btn btn-secondary" href="/manager/branch-assignment"><ClipboardCheck size={16} />Branch Assignment</Link>
        <Link className="btn btn-secondary" href="/manager/mistake"><AlertTriangle size={16} />Mistake</Link>
        <Link className="btn btn-secondary" href="/manager/warning"><AlertTriangle size={16} />Warning</Link>
        <span className="manager-action-spacer" />
        <Link className="btn btn-primary" href="/manager/report"><CalendarDays size={16} />CSR Daily Report</Link>
        <Link className="btn btn-secondary" href="/manager/calls"><Phone size={16} />Call Tracker</Link>
        <button className="btn btn-secondary" type="button"><BarChart3 size={16} />Status Summary</button>
        <button className="btn btn-primary" onClick={refresh} type="button"><RefreshCw size={16} />Refresh</button>
      </div>

      <section className="manager-section">
        <h2><ClipboardCheck size={18} /> Overall Ticket Total <span>All teams · live ER tickets</span></h2>
        <div className="manager-stat-grid">
          <ManagerStat icon={<Ticket size={19} />} label="Total Created Tickets" value={summary.total} tone="cyan" />
          <ManagerStat icon={<ClipboardPlus size={19} />} label="Manually Created Tickets" value={summary.manualTickets} tone="green" />
          <ManagerStat icon={<Ticket size={19} />} label="Customer / Online Tickets" value={summary.customerTickets} tone="purple" />
          <ManagerStat icon={<Shield size={19} />} label="Open / Active Tickets" value={summary.openTickets} tone="yellow" />
          <ManagerStat icon={<ClipboardCheck size={19} />} label="Completed / Closed Tickets" value={summary.completedTickets} tone="green" />
        </div>
      </section>

      <section className="manager-section">
        <h2><CalendarDays size={18} /> Today&apos;s Tickets <span>Created today from the live ER tickets table</span></h2>
        <div className="manager-stat-grid">
          <ManagerStat icon={<CalendarDays size={19} />} label="Tickets Created Today" value={summary.todayTickets} tone="cyan" />
          <ManagerStat icon={<ClipboardPlus size={19} />} label="Manual Today" value={summary.manualToday} tone="green" />
          <ManagerStat icon={<Ticket size={19} />} label="Customer / Online Today" value={summary.customerToday} tone="purple" />
          <ManagerStat icon={<Shield size={19} />} label="Open Today" value={summary.openToday} tone="yellow" />
          <ManagerStat icon={<ClipboardCheck size={19} />} label="Completed Today" value={summary.completedToday} tone="green" />
        </div>
      </section>

      {error ? <div className="customer-alert">{error}</div> : null}
      {staffError ? <div className="customer-alert">{staffError}</div> : null}

      <section className="manager-analytics-grid">
        <div className="manager-chart-panel">
          <div className="manager-chart-head">
            <div>
              <h2>Team Ticket Performance</h2>
              <p>Top {previewTeams.length} teams by ticket activity</p>
            </div>
            <button className="manager-view-all-button" onClick={() => setPerformanceModalOpen(true)} type="button">
              View all {sortedTeams.length}
            </button>
          </div>
          <div className="manager-chart-legend">
            <span className="handled" /> Total tickets
            <span className="connected" /> Today
            <span className="assigned" /> Manual
            <span className="completed" /> Completed
          </div>
          <div className="manager-bar-chart compact-preview">
            {previewTeams.map((team) => (
              <div className="manager-bar-group" key={team.name}>
                <div className="manager-bars">
                  <span className="handled" style={{ height: `${statHeight(team.callsHandled, maxTickets)}px` }} />
                  <span className="connected" style={{ height: `${statHeight(team.todayTickets, maxTickets)}px` }} />
                  <span className="assigned" style={{ height: `${statHeight(team.manualTickets, maxTickets)}px` }} />
                  <span className="completed" style={{ height: `${statHeight(team.completedTickets, maxTickets)}px` }} />
                </div>
                <small>{team.leader}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="manager-chart-panel task-status-panel">
          <h2>Task Status</h2>
          <div className="manager-donut-wrap">
            <div
              className="manager-donut"
              style={{ background: donut }}
            />
            <div className="manager-donut-legend">
              <span><i className="new" /> New Request <b>{newRequests}</b></span>
              <span><i className="assigned" /> Assigned <b>{assigned}</b></span>
              <span><i className="progress" /> In Progress <b>{inProgress}</b></span>
              <span><i className="completed" /> Repair Completed <b>{completed}</b></span>
              <span><i className="cancelled" /> Cancelled <b>{cancelled}</b></span>
            </div>
          </div>
        </div>
      </section>

      <section className="manager-team-preview-section">
        <div className="manager-section-title-row">
          <div>
            <h2><UsersRound size={18} /> Team Snapshot</h2>
            <p>Showing the top {dashboardTeams.length} teams. Open the full view when you need everyone.</p>
          </div>
          <button className="manager-view-all-button" onClick={() => setPerformanceModalOpen(true)} type="button">
            View all teams
          </button>
        </div>
        <div className="manager-teams-grid">
          {dashboardTeams.map((team, index) => (
            <TeamPerformanceCard key={team.name} team={team} index={index} />
          ))}
        </div>
      </section>

      <section className="manager-bottom-grid">
        <EmptyManagerBox title="Recent Mistakes" tone="mistake" />
        <EmptyManagerBox title="Recent Warnings" tone="warning" />
      </section>

      {performanceModalOpen ? (
        <TeamPerformanceModal teams={sortedTeams} maxTickets={maxTickets} onClose={() => setPerformanceModalOpen(false)} />
      ) : null}
    </div>
  );
}
