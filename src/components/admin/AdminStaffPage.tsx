'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  Eye,
  Filter,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { AdminEmptyState, AdminPageHeader, AdminPanel, AdminStatGrid } from '@/components/admin/AdminUi';
import { fetchJsonWithFirebase } from '@/lib/auth/client';

type StaffProfile = {
  id: string;
  company_id: string | null;
  email: string | null;
  username: string | null;
  display_name: string;
  role: string;
  role_label: string;
  role_family: string;
  phone_number: string | null;
  employee_id: string | null;
  department: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  manager_name: string | null;
  assigned_branch: string | null;
  branches: string[];
  branch_count: number;
  technician_id: string | null;
  po_initials: string | null;
  required_check_in: string | null;
  required_check_out: string | null;
  email_report_location: string | null;
  sms_status: string | null;
  off_days: string[];
  work_plan_branch_count: number;
  work_plan_branches: string[];
  source: string;
};

type StaffResponse = {
  staff?: StaffProfile[];
  message?: string;
};

type RoleFilter = 'all' | 'admin' | 'manager' | 'team_leader' | 'agent';
type StatusFilter = 'all' | 'active' | 'inactive';

type StaffOption = {
  value: string;
  label: string;
};

const roleFilterOptions: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'All Roles' },
  { value: 'admin', label: 'Admin / Super Admin' },
  { value: 'manager', label: 'CSR Managers' },
  { value: 'team_leader', label: 'CSR Team Leaders' },
  { value: 'agent', label: 'CSR Agents' },
];

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase().trim();
}

function formatDate(value: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function shortDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function optionize(values: Array<string | null | undefined>, fallback = 'Unassigned') {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]))
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value || fallback }));
}

function roleTone(roleFamily: string) {
  const tones: Record<string, string> = {
    admin: 'cyan',
    manager: 'purple',
    team_leader: 'blue',
    agent: 'green',
  };
  return tones[roleFamily] ?? 'neutral';
}

function getLeadershipRank(roleFamily: string) {
  const ranks: Record<string, number> = {
    admin: 1,
    manager: 2,
    team_leader: 3,
    agent: 4,
  };
  return ranks[roleFamily] ?? 99;
}

function matchesBranch(staff: StaffProfile, branch: string) {
  if (branch === 'all') return true;
  const target = normalize(branch);
  return normalize(staff.assigned_branch) === target || staff.branches.some((item) => normalize(item) === target);
}

function branchSummary(staff: StaffProfile) {
  if (staff.branch_count > 1) return `${staff.branch_count} branches`;
  return staff.assigned_branch || staff.branches[0] || 'No branch';
}

function StaffBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`admin-staff-badge ${tone}`}>{children}</span>;
}

function InfoTile({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="admin-staff-info-tile">
      <div className="admin-staff-info-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value || 'Not available'}</strong>
      </div>
    </div>
  );
}

function DetailPair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="admin-staff-detail-pair">
      <span>{label}</span>
      <strong>{value || 'Not available'}</strong>
    </div>
  );
}

export function AdminStaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);

  useEffect(() => {
    if (!user) {
      setStaff([]);
      setIsLoading(false);
      return;
    }
    const authUser = user;

    let isMounted = true;

    async function loadStaff() {
      setIsLoading(true);
      setError(null);
      try {
        const payload = await fetchJsonWithFirebase<StaffResponse>(
          authUser,
          '/api/admin/catalogs?type=staff',
          { cache: 'no-store' },
        );
        if (isMounted) setStaff(payload.staff ?? []);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Unable to load staff profiles.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadStaff();
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!selectedStaff) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedStaff(null);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedStaff]);

  const branchOptions = useMemo<StaffOption[]>(() => {
    const branches = staff.flatMap((profile) => [profile.assigned_branch, ...profile.branches]);
    return [{ value: 'all', label: 'All Branches' }, ...optionize(branches)];
  }, [staff]);

  const managerOptions = useMemo<StaffOption[]>(() => {
    return [{ value: 'all', label: 'All Managers' }, ...optionize(staff.map((profile) => profile.manager_name))];
  }, [staff]);

  const filteredStaff = useMemo(() => {
    const query = normalize(search);

    return staff
      .filter((profile) => {
        if (roleFilter !== 'all' && profile.role_family !== roleFilter) return false;
        if (statusFilter === 'active' && !profile.is_active) return false;
        if (statusFilter === 'inactive' && profile.is_active) return false;
        if (!matchesBranch(profile, branchFilter)) return false;
        if (managerFilter !== 'all' && normalize(profile.manager_name) !== normalize(managerFilter)) return false;

        if (!query) return true;
        return [
          profile.display_name,
          profile.email,
          profile.username,
          profile.role_label,
          profile.manager_name,
          profile.assigned_branch,
          profile.employee_id,
          profile.technician_id,
          profile.po_initials,
          ...profile.branches,
        ].some((value) => normalize(value).includes(query));
      })
      .sort((a, b) => {
        const rank = getLeadershipRank(a.role_family) - getLeadershipRank(b.role_family);
        if (rank !== 0) return rank;
        return a.display_name.localeCompare(b.display_name);
      });
  }, [branchFilter, managerFilter, roleFilter, search, staff, statusFilter]);

  const totals = useMemo(() => {
    const countByFamily = (family: string) => staff.filter((profile) => profile.role_family === family).length;
    const active = staff.filter((profile) => profile.is_active).length;
    const withLogin = staff.filter((profile) => Boolean(profile.last_login)).length;
    const branchSet = new Set(staff.flatMap((profile) => [profile.assigned_branch, ...profile.branches].filter(Boolean)) as string[]);

    return {
      total: staff.length,
      active,
      admins: countByFamily('admin'),
      managers: countByFamily('manager'),
      leaders: countByFamily('team_leader'),
      agents: countByFamily('agent'),
      branches: branchSet.size,
      withLogin,
    };
  }, [staff]);

  const leadership = useMemo(() => {
    return staff
      .filter((profile) => ['admin', 'manager', 'team_leader'].includes(profile.role_family))
      .sort((a, b) => {
        const rank = getLeadershipRank(a.role_family) - getLeadershipRank(b.role_family);
        if (rank !== 0) return rank;
        return a.display_name.localeCompare(b.display_name);
      })
      .slice(0, 8);
  }, [staff]);

  const roleBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; family: string; count: number; active: number }>();
    staff.forEach((profile) => {
      const key = profile.role_label;
      const current = map.get(key) ?? { label: key, family: profile.role_family, count: 0, active: 0 };
      current.count += 1;
      if (profile.is_active) current.active += 1;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [staff]);

  const topBranches = useMemo(() => {
    const map = new Map<string, number>();
    staff.forEach((profile) => {
      const branches = profile.branches.length ? profile.branches : profile.assigned_branch ? [profile.assigned_branch] : [];
      branches.forEach((branch) => map.set(branch, (map.get(branch) ?? 0) + 1));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10);
  }, [staff]);

  const filterFromInsight = (family: string) => {
    setRoleFilter(family as RoleFilter);
    requestAnimationFrame(() => {
      document.getElementById('staff-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="admin-dashboard admin-staff-page">
      <AdminPageHeader
        actions={<StaffBadge tone="cyan">View-only from ER profiles</StaffBadge>}
        description="Live staff directory from the ER profiles table. This page is intentionally read-only while those accounts are active on the ER side."
        eyebrow="People and roles"
        title="Staff Management"
      />

      <AdminStatGrid
        stats={[
          { label: 'Total Staff', value: totals.total, tone: 'cyan', helper: 'ER profiles shown' },
          { label: 'Admins', value: totals.admins, tone: 'blue', helper: 'Admin/Super Admin' },
          { label: 'CSR Managers', value: totals.managers, tone: 'green', helper: 'CSR Manager' },
          { label: 'Team Leaders', value: totals.leaders, tone: 'purple', helper: 'CSR leadership' },
          { label: 'CSR Agents', value: totals.agents, tone: 'yellow', helper: 'Assigned agents' },
          { label: 'Branches Covered', value: totals.branches, tone: 'neutral', helper: 'Branch access count' },
        ]}
      />

      {error ? <div className="customer-alert">{error}</div> : null}

      <div id="staff-directory">
        <AdminPanel
          action={<StaffBadge>{filteredStaff.length} shown</StaffBadge>}
          subtitle="Search, role, status, branch, and manager filters. No password reset or account edits are exposed here."
          title="Filtered Staff Directory"
        >
        <div className="admin-staff-toolbar">
          <label className="admin-staff-search">
            <Search size={16} />
            <input
              aria-label="Search staff"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, username, PO initials, branch..."
              value={search}
            />
          </label>
          <label className="admin-staff-filter">
            <Filter size={15} />
            <select onChange={(event) => setRoleFilter(event.target.value as RoleFilter)} value={roleFilter}>
              {roleFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="admin-staff-filter">
            <CheckCircle2 size={15} />
            <select onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} value={statusFilter}>
              <option value="all">All Status</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </label>
          <label className="admin-staff-filter">
            <MapPin size={15} />
            <select onChange={(event) => setBranchFilter(event.target.value)} value={branchFilter}>
              {branchOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="admin-staff-filter">
            <UsersRound size={15} />
            <select onChange={(event) => setManagerFilter(event.target.value)} value={managerFilter}>
              {managerOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? (
          <AdminEmptyState label="Loading staff profiles from ER..." />
        ) : filteredStaff.length ? (
          <div className="admin-staff-table-wrap">
            <table className="admin-staff-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Role</th>
                  <th>Manager / Branch</th>
                  <th>Coverage</th>
                  <th>Check-in</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>View</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <button className="admin-staff-person" onClick={() => setSelectedStaff(profile)} type="button">
                        <span className={`admin-staff-avatar ${roleTone(profile.role_family)}`}>{profile.po_initials}</span>
                        <span>
                          <strong>{profile.display_name}</strong>
                          <small>{profile.email || profile.username || 'No email'}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <StaffBadge tone={roleTone(profile.role_family)}>{profile.role_label}</StaffBadge>
                      {profile.department ? <small className="admin-staff-subtext">{profile.department}</small> : null}
                    </td>
                    <td>
                      <strong>{profile.manager_name || 'Unassigned'}</strong>
                      <small className="admin-staff-subtext">{profile.assigned_branch || 'No assigned branch'}</small>
                    </td>
                    <td>
                      <strong>{branchSummary(profile)}</strong>
                      <small className="admin-staff-subtext">Work plan: {profile.work_plan_branch_count || 0} branches</small>
                    </td>
                    <td>
                      <strong>{profile.required_check_in || '—'} / {profile.required_check_out || '—'}</strong>
                      <small className="admin-staff-subtext">SMS: {profile.sms_status || 'Not available'}</small>
                    </td>
                    <td>
                      <StaffBadge tone={profile.is_active ? 'green' : 'red'}>{profile.is_active ? 'Active' : 'Inactive'}</StaffBadge>
                    </td>
                    <td>{shortDate(profile.last_login)}</td>
                    <td>
                      <button className="admin-staff-view-btn" onClick={() => setSelectedStaff(profile)} type="button">
                        <Eye size={15} /> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState label="No staff matches the current filters." />
        )}
        </AdminPanel>
      </div>

      <AdminPanel
        action={<StaffBadge tone="purple">{leadership.length} highlighted</StaffBadge>}
        subtitle="A compact view of team leadership and role distribution. Select a role to filter the staff directory."
        title="Team Overview"
      >
        <div className="admin-staff-insights-grid">
          <section className="admin-staff-insight-section">
            <div className="admin-staff-insight-head">
              <span className="admin-staff-insight-icon"><UsersRound size={17} /></span>
              <div>
                <h3>Leadership</h3>
                <p>Admins, managers, and team leads</p>
              </div>
            </div>
            <div className="admin-staff-leadership-grid">
              {leadership.map((profile) => (
                <button className="admin-staff-leader-card" key={profile.id} onClick={() => setSelectedStaff(profile)} type="button">
                  <span className={`admin-staff-avatar ${roleTone(profile.role_family)}`}>{profile.po_initials}</span>
                  <span className="admin-staff-leader-copy">
                    <strong>{profile.display_name}</strong>
                    <small>{profile.role_label}</small>
                    <em>{profile.assigned_branch || profile.manager_name || 'ER profile'}</em>
                  </span>
                  <Eye size={15} />
                </button>
              ))}
              {!leadership.length ? <AdminEmptyState label="No leadership records found." /> : null}
            </div>
          </section>

          <section className="admin-staff-insight-section">
            <div className="admin-staff-insight-head">
              <span className="admin-staff-insight-icon purple"><BriefcaseBusiness size={17} /></span>
              <div>
                <h3>Role distribution</h3>
                <p>{roleBreakdown.length} roles across {totals.total} staff</p>
              </div>
            </div>
            <div className="admin-staff-role-grid">
              {roleBreakdown.map((role) => (
                <button
                  className={`admin-staff-role-card ${roleTone(role.family)}`}
                  key={role.label}
                  onClick={() => filterFromInsight(role.family)}
                  type="button"
                >
                  <span className="admin-staff-role-card-head">
                    <strong>{role.label}</strong>
                    <b>{role.count}</b>
                  </span>
                  <span className="admin-staff-role-bar" aria-hidden="true">
                    <span style={{ width: `${Math.max(8, (role.count / Math.max(totals.total, 1)) * 100)}%` }} />
                  </span>
                  <small>{role.active === role.count ? 'All active' : `${role.active} active`}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      </AdminPanel>

      <AdminPanel subtitle="Branches with the highest number of staff access entries." title="Branch Access Overview">
        <div className="admin-staff-branch-cloud">
          {topBranches.map(([branch, count]) => (
            <button key={branch} onClick={() => setBranchFilter(branch)} type="button">
              <span>{branch}</span>
              <strong>{count}</strong>
            </button>
          ))}
          {!topBranches.length ? <AdminEmptyState label="No branch access found in ER profiles." /> : null}
        </div>
      </AdminPanel>

      {selectedStaff ? (
        <div className="admin-modal-backdrop" onClick={() => setSelectedStaff(null)} role="presentation">
          <div className="admin-modal admin-staff-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="staff-profile-title">
            <div className="admin-modal-head">
              <div className="admin-staff-modal-title">
                <span className={`admin-staff-avatar large ${roleTone(selectedStaff.role_family)}`}>{selectedStaff.po_initials}</span>
                <div>
                  <span className="admin-staff-modal-eyebrow">ER staff profile</span>
                  <h2 id="staff-profile-title">{selectedStaff.display_name}</h2>
                  <div className="admin-staff-modal-badges">
                    <StaffBadge tone={roleTone(selectedStaff.role_family)}>{selectedStaff.role_label}</StaffBadge>
                    <StaffBadge tone={selectedStaff.is_active ? 'green' : 'red'}>{selectedStaff.is_active ? 'Active' : 'Inactive'}</StaffBadge>
                  </div>
                </div>
              </div>
              <button className="admin-icon-btn ghost" onClick={() => setSelectedStaff(null)} type="button" aria-label="Close staff details">
                <X size={18} />
              </button>
            </div>

            <div className="admin-staff-modal-body">
              <div className="admin-staff-detail-grid">
                <InfoTile icon={<Mail size={16} />} label="Email" value={selectedStaff.email} />
                <InfoTile icon={<Phone size={16} />} label="Phone" value={selectedStaff.phone_number} />
                <InfoTile icon={<UsersRound size={16} />} label="Manager" value={selectedStaff.manager_name} />
                <InfoTile icon={<Building2 size={16} />} label="Assigned Branch" value={selectedStaff.assigned_branch} />
              </div>

              <div className="admin-staff-modal-columns">
                <section className="admin-staff-modal-card">
                  <div className="admin-staff-modal-card-head">
                    <BriefcaseBusiness size={17} />
                    <div><h3>Account details</h3><p>Identity and assignment information</p></div>
                  </div>
                  <div className="admin-staff-pair-grid">
                    <DetailPair label="Department" value={selectedStaff.department || selectedStaff.role_label} />
                    <DetailPair label="Username" value={selectedStaff.username} />
                    <DetailPair label="Employee ID" value={selectedStaff.employee_id} />
                    <DetailPair label="Technician ID" value={selectedStaff.technician_id} />
                    <DetailPair label="PO Initials" value={selectedStaff.po_initials} />
                    <DetailPair label="SMS Status" value={selectedStaff.sms_status} />
                  </div>
                </section>

                <section className="admin-staff-modal-card">
                  <div className="admin-staff-modal-card-head">
                    <CalendarClock size={17} />
                    <div><h3>Schedule & activity</h3><p>Attendance rules and recent activity</p></div>
                  </div>
                  <div className="admin-staff-pair-grid">
                    <DetailPair label="Required Check In" value={selectedStaff.required_check_in || '—'} />
                    <DetailPair label="Required Check Out" value={selectedStaff.required_check_out || '—'} />
                    <DetailPair label="Last Login" value={formatDate(selectedStaff.last_login)} />
                    <DetailPair label="Created" value={formatDate(selectedStaff.created_at)} />
                    <DetailPair label="Last Updated" value={formatDate(selectedStaff.updated_at)} />
                    <DetailPair label="Source" value={selectedStaff.source} />
                  </div>
                </section>
              </div>

              <section className="admin-staff-modal-card admin-staff-access-card">
                <div className="admin-staff-modal-card-head">
                  <MapPin size={17} />
                  <div><h3>Location access</h3><p>Assigned access and work-plan coverage</p></div>
                </div>
                <div className="admin-staff-access-grid">
                  <div>
                    <div className="admin-staff-access-title"><span>Branch access</span><strong>{selectedStaff.branches.length}</strong></div>
                    <div className="admin-staff-chip-wrap">
                      {selectedStaff.branches.slice(0, 12).map((branch) => <span key={branch}>{branch}</span>)}
                      {selectedStaff.branches.length > 12 ? <b>+{selectedStaff.branches.length - 12} more</b> : null}
                      {!selectedStaff.branches.length ? <em>No branch access listed.</em> : null}
                    </div>
                  </div>
                  <div>
                    <div className="admin-staff-access-title"><span>Work-plan branches</span><strong>{selectedStaff.work_plan_branch_count}</strong></div>
                    <div className="admin-staff-chip-wrap compact">
                      {selectedStaff.work_plan_branches.slice(0, 12).map((branch) => <span key={branch}>{branch}</span>)}
                      {selectedStaff.work_plan_branches.length > 12 ? <b>+{selectedStaff.work_plan_branches.length - 12} more</b> : null}
                      {!selectedStaff.work_plan_branches.length ? <em>No work-plan branches found.</em> : null}
                    </div>
                  </div>
                </div>
              </section>

              <div className="admin-staff-readonly-note">
                <ShieldCheck size={16} />
                <span><strong>Read-only ER record.</strong> Passwords, activation, and profile details remain managed by the ER team.</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
