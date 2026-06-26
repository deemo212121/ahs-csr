'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Filter,
  Mail,
  MapPin,
  MapPinned,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { AdminEmptyState, AdminPageHeader, AdminPanel, AdminStatGrid } from '@/components/admin/AdminUi';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import type { ServiceRequest } from '@/lib/types';

type StaffProfile = {
  id: string;
  display_name: string;
  email: string | null;
  username: string | null;
  role_label: string;
  role_family: string;
  department: string | null;
  is_active: boolean;
  manager_name: string | null;
  assigned_branch: string | null;
  branches: string[];
  work_plan_branches: string[];
  po_initials: string | null;
};

type StaffResponse = {
  staff?: StaffProfile[];
  message?: string;
};

type AssignmentKind = 'primary' | 'access' | 'work_plan';
type AssignmentFilter = 'all' | AssignmentKind;

type BranchMember = {
  profile: StaffProfile;
  assignment: AssignmentKind;
};

type BranchTeam = {
  name: string;
  members: BranchMember[];
  requests: ServiceRequest[];
  primary: number;
  access: number;
  workPlan: number;
  active: number;
  pending: number;
  approved: number;
};

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isUsableBranch(value: string | null | undefined) {
  const branch = value?.trim();
  return Boolean(branch && branch !== '-' && !/^\d+$/.test(branch));
}

function roleTone(roleFamily: string) {
  const tones: Record<string, string> = {
    admin: 'cyan',
    manager: 'purple',
    team_leader: 'blue',
    agent: 'green',
    branch_manager: 'yellow',
    technician: 'neutral',
    finance: 'yellow',
    hr: 'purple',
  };
  return tones[roleFamily] ?? 'neutral';
}

function assignmentLabel(kind: AssignmentKind) {
  if (kind === 'primary') return 'Primary team';
  if (kind === 'access') return 'Branch access';
  return 'Work-plan coverage';
}

function assignmentForBranch(profile: StaffProfile, branch: string): AssignmentKind | null {
  const target = normalize(branch);
  if (normalize(profile.assigned_branch) === target) return 'primary';
  if (profile.branches.some((item) => normalize(item) === target)) return 'access';
  if (profile.work_plan_branches.some((item) => normalize(item) === target)) return 'work_plan';
  return null;
}

function requestMatchesBranch(request: ServiceRequest, branch: string) {
  const branchKey = normalize(branch);
  if (!branchKey) return false;

  const requestKeys = [
    request.city,
    request.region,
    request.state,
    [request.city, request.state].filter(Boolean).join(' '),
    request.service_address,
    request.er_ticket?.location,
    request.er_ticket?.customer_city,
    [request.er_ticket?.customer_city, request.er_ticket?.customer_state].filter(Boolean).join(' '),
  ]
    .map((value) => normalize(value))
    .filter(Boolean);

  return requestKeys.some((value) => value === branchKey || value.includes(branchKey));
}

function initials(profile: StaffProfile) {
  if (profile.po_initials?.trim()) return profile.po_initials.trim().slice(0, 3).toUpperCase();
  return profile.display_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'ST';
}

function BranchBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`admin-branch-badge ${tone}`}>{children}</span>;
}

export function AdminBranchAssignmentsPage() {
  const { user } = useAuth();
  const { requests, loading: requestsLoading, error: requestsError } = useLeadershipRequests(300);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');

  useEffect(() => {
    if (!user) {
      setStaff([]);
      setStaffLoading(false);
      return;
    }
    const authUser = user;
    let mounted = true;

    async function loadStaff() {
      setStaffLoading(true);
      setStaffError(null);
      try {
        const data = await fetchJsonWithFirebase<StaffResponse>(authUser, '/api/admin/catalogs?type=staff', { cache: 'no-store' });
        if (mounted) setStaff(data.staff ?? []);
      } catch (error) {
        if (mounted) setStaffError(error instanceof Error ? error.message : 'Unable to load ER staff assignments.');
      } finally {
        if (mounted) setStaffLoading(false);
      }
    }

    void loadStaff();
    return () => {
      mounted = false;
    };
  }, [user]);

  const branchTeams = useMemo<BranchTeam[]>(() => {
    const names = new Set<string>();
    staff.forEach((profile) => {
      [profile.assigned_branch, ...profile.branches, ...profile.work_plan_branches]
        .filter((branch): branch is string => isUsableBranch(branch))
        .forEach((branch) => names.add(branch.trim()));
    });

    return Array.from(names)
      .map((name) => {
        const members = staff
          .map((profile) => ({ profile, assignment: assignmentForBranch(profile, name) }))
          .filter((member): member is BranchMember => Boolean(member.assignment))
          .sort((a, b) => {
            const rank = { primary: 0, access: 1, work_plan: 2 };
            return rank[a.assignment] - rank[b.assignment] || a.profile.display_name.localeCompare(b.profile.display_name);
          });
        const branchRequests = requests.filter((request) => requestMatchesBranch(request, name));

        return {
          name,
          members,
          requests: branchRequests,
          primary: members.filter((member) => member.assignment === 'primary').length,
          access: members.filter((member) => member.assignment === 'access').length,
          workPlan: members.filter((member) => member.assignment === 'work_plan').length,
          active: members.filter((member) => member.profile.is_active).length,
          pending: branchRequests.filter((request) => request.verification_status === 'pending').length,
          approved: branchRequests.filter((request) => request.verification_status === 'approved').length,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [requests, staff]);

  useEffect(() => {
    if (!branchTeams.length) return;
    if (!branchTeams.some((branch) => branch.name === selectedBranch)) {
      setSelectedBranch(branchTeams[0].name);
    }
  }, [branchTeams, selectedBranch]);

  const visibleBranches = useMemo(() => {
    const query = normalize(branchSearch);
    if (!query) return branchTeams;
    return branchTeams.filter((branch) => normalize(branch.name).includes(query));
  }, [branchSearch, branchTeams]);

  const currentBranch = branchTeams.find((branch) => branch.name === selectedBranch) ?? null;

  const roleOptions = useMemo(() => {
    if (!currentBranch) return [];
    return Array.from(new Set(currentBranch.members.map((member) => member.profile.role_label)))
      .sort((a, b) => a.localeCompare(b));
  }, [currentBranch]);

  const visibleMembers = useMemo(() => {
    if (!currentBranch) return [];
    const query = normalize(staffSearch);
    return currentBranch.members.filter(({ profile, assignment }) => {
      if (roleFilter !== 'all' && profile.role_label !== roleFilter) return false;
      if (assignmentFilter !== 'all' && assignment !== assignmentFilter) return false;
      if (!query) return true;
      return [profile.display_name, profile.email, profile.username, profile.role_label, profile.department, profile.manager_name]
        .some((value) => normalize(value).includes(query));
    });
  }, [assignmentFilter, currentBranch, roleFilter, staffSearch]);

  useEffect(() => {
    setRoleFilter('all');
    setAssignmentFilter('all');
    setStaffSearch('');
  }, [selectedBranch]);

  const totalPrimary = staff.filter((profile) => isUsableBranch(profile.assigned_branch)).length;
  const isLoading = staffLoading || requestsLoading;
  const error = staffError || requestsError;

  return (
    <div className="admin-dashboard admin-branch-page">
      <AdminPageHeader
        actions={<BranchBadge tone="cyan"><ShieldCheck size={14} /> Live ER profiles</BranchBadge>}
        description="Explore each service branch and the staff assigned through primary placement, branch access, or work-plan coverage."
        eyebrow="People and territory"
        title="Branch Teams"
      />

      <AdminStatGrid
        stats={[
          { label: 'Mapped Branches', value: branchTeams.length, tone: 'cyan', helper: 'Valid ER branch records' },
          { label: 'Active Staff', value: staff.filter((profile) => profile.is_active).length, tone: 'green', helper: 'Across the ER directory' },
          { label: 'Primary Assignments', value: totalPrimary, tone: 'blue', helper: 'Direct assigned_branch values' },
          { label: 'Selected Branch Requests', value: currentBranch?.requests.length ?? 0, tone: 'purple', helper: selectedBranch || 'Choose a branch' },
        ]}
      />

      {error ? <div className="customer-alert">{error}</div> : null}

      <AdminPanel
        action={currentBranch ? <BranchBadge tone="green">{visibleMembers.length} people shown</BranchBadge> : null}
        subtitle="Choose a branch to see its complete team. Assignment labels explain why each person appears in that branch."
        title="Branch Directory"
      >
        {isLoading ? (
          <AdminEmptyState label="Building branch teams from ER profiles..." />
        ) : branchTeams.length ? (
          <div className="admin-branch-workspace">
            <aside className="admin-branch-rail">
              <div className="admin-branch-rail-head">
                <div>
                  <span>Service network</span>
                  <strong>{branchTeams.length} branches</strong>
                </div>
                <MapPinned size={19} />
              </div>
              <label className="admin-branch-search">
                <Search size={15} />
                <input aria-label="Search branches" onChange={(event) => setBranchSearch(event.target.value)} placeholder="Find a branch..." value={branchSearch} />
              </label>
              <div className="admin-branch-list">
                {visibleBranches.map((branch) => (
                  <button
                    className={branch.name === selectedBranch ? 'active' : ''}
                    key={branch.name}
                    onClick={() => setSelectedBranch(branch.name)}
                    type="button"
                  >
                    <span className="admin-branch-list-icon"><MapPin size={15} /></span>
                    <span>
                      <strong>{branch.name}</strong>
                      <small>{branch.members.length} staff · {branch.requests.length} requests</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
                {!visibleBranches.length ? <AdminEmptyState label="No matching branch." /> : null}
              </div>
            </aside>

            <section className="admin-branch-team">
              {currentBranch ? (
                <>
                  <div className="admin-branch-team-hero">
                    <div className="admin-branch-team-icon"><MapPinned size={24} /></div>
                    <div className="admin-branch-team-copy">
                      <span>Selected branch</span>
                      <h2>{currentBranch.name}</h2>
                      <p>{currentBranch.primary} primary · {currentBranch.access} branch access · {currentBranch.workPlan} work-plan coverage</p>
                    </div>
                    <BranchBadge tone={currentBranch.active ? 'green' : 'neutral'}><CheckCircle2 size={13} /> {currentBranch.active} active</BranchBadge>
                  </div>

                  <div className="admin-branch-metrics">
                    <div><UsersRound size={17} /><span>Team size</span><strong>{currentBranch.members.length}</strong></div>
                    <div><UserRoundCheck size={17} /><span>Primary</span><strong>{currentBranch.primary}</strong></div>
                    <div><BriefcaseBusiness size={17} /><span>Open queue</span><strong>{currentBranch.pending}</strong></div>
                    <div><CheckCircle2 size={17} /><span>Approved</span><strong>{currentBranch.approved}</strong></div>
                  </div>

                  <div className="admin-branch-filters">
                    <label className="admin-branch-search staff">
                      <Search size={15} />
                      <input aria-label="Search branch staff" onChange={(event) => setStaffSearch(event.target.value)} placeholder="Search this team..." value={staffSearch} />
                    </label>
                    <label className="admin-branch-select">
                      <Filter size={14} />
                      <select aria-label="Filter by role" onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}>
                        <option value="all">All roles</option>
                        {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </label>
                    <label className="admin-branch-select">
                      <MapPin size={14} />
                      <select aria-label="Filter by assignment type" onChange={(event) => setAssignmentFilter(event.target.value as AssignmentFilter)} value={assignmentFilter}>
                        <option value="all">All assignments</option>
                        <option value="primary">Primary team</option>
                        <option value="access">Branch access</option>
                        <option value="work_plan">Work-plan coverage</option>
                      </select>
                    </label>
                  </div>

                  <div className="admin-branch-roster-head">
                    <div><h3>Assigned team</h3><p>{visibleMembers.length} of {currentBranch.members.length} people match the current filters</p></div>
                  </div>

                  <div className="admin-branch-roster">
                    {visibleMembers.map(({ profile, assignment }) => (
                      <article className="admin-branch-member" key={profile.id}>
                        <div className="admin-branch-member-head">
                          <span className={`admin-branch-avatar ${roleTone(profile.role_family)}`}>{initials(profile)}</span>
                          <div>
                            <h4>{profile.display_name}</h4>
                            <p>{profile.role_label}</p>
                          </div>
                          <span className={`admin-branch-status ${profile.is_active ? 'active' : ''}`} title={profile.is_active ? 'Active' : 'Inactive'} />
                        </div>
                        <div className="admin-branch-member-badges">
                          <BranchBadge tone={roleTone(profile.role_family)}>{profile.role_label}</BranchBadge>
                          <BranchBadge tone={assignment === 'primary' ? 'green' : assignment === 'access' ? 'blue' : 'purple'}>{assignmentLabel(assignment)}</BranchBadge>
                        </div>
                        <div className="admin-branch-member-details">
                          <span><UsersRound size={13} /> {profile.manager_name || 'No manager listed'}</span>
                          <span><BriefcaseBusiness size={13} /> {profile.department || 'No department listed'}</span>
                          <span><Mail size={13} /> {profile.email || profile.username || 'No email listed'}</span>
                        </div>
                      </article>
                    ))}
                    {!visibleMembers.length ? <AdminEmptyState label="No staff match these branch filters." /> : null}
                  </div>
                </>
              ) : (
                <AdminEmptyState label="Choose a branch to view its assigned team." />
              )}
            </section>
          </div>
        ) : (
          <AdminEmptyState label="No valid branch assignments were found in ER profiles." />
        )}
      </AdminPanel>
    </div>
  );
}
