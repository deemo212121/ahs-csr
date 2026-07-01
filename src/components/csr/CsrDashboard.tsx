'use client';

import {
  Clock3,
  ClipboardList,
  Headphones,
  Mail,
  MapPin,
  Shield,
  UserSquare2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';
import { fetchJsonWithFirebase, type AuthTokenUser } from '@/lib/auth/client';
import type { RtcCall, RtcCallListResponse } from '@/lib/calls/types';
import type { ServiceRequest } from '@/lib/types';

export function getLastLogin(user: AuthTokenUser | null): string | null {
  if (!user) return null;
  if ('metadata' in user && user.metadata?.lastSignInTime) return user.metadata.lastSignInTime;
  if ('supabaseUser' in user && user.supabaseUser?.last_sign_in_at) return user.supabaseUser.last_sign_in_at;
  return null;
}

export function EmptyRow({ label }: { label: string }) {
  return (
    <div className="agent-empty-row">
      <span>{label}</span>
    </div>
  );
}

export function ticketNo(request: ServiceRequest) {
  return request.er_ticket?.ticket_no || request.request_number || '—';
}

export function reviewedAt(request: ServiceRequest) {
  return request.updated_at || request.requested_at;
}

export function isRestored(request: ServiceRequest) {
  return request.verification_status === 'pending' && !!request.verification_notes?.startsWith('[RESTORED]');
}

export type TicketDisplayStatus = 'approved' | 'rejected' | 'restored';

export function ticketDisplayStatus(request: ServiceRequest): TicketDisplayStatus {
  if (isRestored(request)) return 'restored';
  return request.verification_status === 'approved' ? 'approved' : 'rejected';
}

export function ticketNoteText(request: ServiceRequest, displayStatus: TicketDisplayStatus) {
  if (displayStatus === 'restored') {
    return request.verification_reject_reason
      ? `Restored — original reject reason: ${request.verification_reject_reason}`
      : 'Restored to pending for re-review.';
  }
  if (displayStatus === 'rejected') return request.verification_reject_reason || '—';
  return request.verification_notes || '—';
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function isToday(value?: string | null) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  return parsed.getFullYear() === now.getFullYear() && parsed.getMonth() === now.getMonth() && parsed.getDate() === now.getDate();
}

export function formatCallDuration(seconds?: number | null) {
  if (!seconds) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

export function TicketSummaryModal({ request, onClose }: { request: ServiceRequest; onClose: () => void }) {
  const displayStatus = ticketDisplayStatus(request);
  return (
    <div className="csr-summary-backdrop" role="presentation" onClick={onClose}>
      <section className="csr-summary-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="csr-summary-eyebrow"><ClipboardList size={14} /> Verified ticket</span>
            <h2>{request.full_name || 'Unknown customer'}</h2>
            <p>{ticketNo(request)}</p>
          </div>
          <button aria-label="Close ticket summary" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <div className="csr-summary-grid">
          <div><span>Date Reviewed</span><strong>{formatDateTime(reviewedAt(request))}</strong></div>
          <div><span>Status</span><strong className={`agent-pill ${displayStatus}`}>{displayStatus}</strong></div>
          <div><span>Branch / Region</span><strong>{request.region || '—'}</strong></div>
          <div><span>Phone</span><strong>{request.phone_number || '—'}</strong></div>
          <div><span>Email</span><strong>{request.customer_email || '—'}</strong></div>
          <div><span>Service Address</span><strong>{request.service_address || '—'}</strong></div>
        </div>
        <div className="csr-summary-notes">
          <h3>Notes</h3>
          <p>{ticketNoteText(request, displayStatus)}</p>
        </div>
      </section>
    </div>
  );
}

export function CallSummaryModal({
  call,
  user,
  onClose,
  onNoteSaved,
}: {
  call: RtcCall;
  user: AuthTokenUser | null;
  onClose: () => void;
  onNoteSaved: (updated: RtcCall) => void;
}) {
  const [noteDraft, setNoteDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasNote = !!call.notes?.trim();

  async function saveNote() {
    if (!user || saving || hasNote) return;
    const note = noteDraft.trim();
    if (!note) {
      setSaveError('Note cannot be empty.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const data = await fetchJsonWithFirebase<{ call: RtcCall }>(user, `/api/calls/${call.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'add_note', note }),
      });
      onNoteSaved({ ...call, ...data.call });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save note.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="csr-summary-backdrop" role="presentation" onClick={onClose}>
      <section className="csr-summary-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="csr-summary-eyebrow"><Headphones size={14} /> Web call</span>
            <h2>{call.customer_name}</h2>
            <p>{call.request_number || 'No linked ticket'}</p>
          </div>
          <button aria-label="Close call summary" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <div className="csr-summary-grid">
          <div><span>Date</span><strong>{formatDateTime(call.queued_at)}</strong></div>
          <div><span>Status</span><strong className="agent-pill completed">{call.status}</strong></div>
          <div><span>Region</span><strong><MapPin size={13} /> {call.branch || '—'}</strong></div>
          <div><span>Duration</span><strong>{formatCallDuration(call.call_duration_seconds)}</strong></div>
          <div><span>Phone</span><strong>{call.phone_number || '—'}</strong></div>
          <div><span>Email</span><strong>{call.customer_email || '—'}</strong></div>
        </div>
        <div className="csr-summary-notes">
          <h3>Notes</h3>
          {hasNote ? (
            <p>{call.notes}</p>
          ) : (
            <div className="csr-note-form">
              <textarea
                maxLength={1000}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Add a note for this call. This can only be saved once and cannot be edited afterward."
                rows={3}
                value={noteDraft}
              />
              {saveError ? <p className="csr-note-error">{saveError}</p> : null}
              <button className="csr-note-save-btn" disabled={saving || !noteDraft.trim()} onClick={() => void saveNote()} type="button">
                {saving ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function branchChips(value?: string | null) {
  const branches = (value || '')
    .split('|')
    .map((branch) => branch.trim())
    .filter(Boolean)
    .slice(0, 5);

  return branches.length ? branches : ['ER profile branch filter'];
}

const positionLabels: Record<string, string> = {
  csr: 'CSR Agent',
  team_leader: 'Team Leader',
  csr_manager: 'CSR Manager',
  admin: 'Admin',
};

export function CsrDashboard() {
  const { profile, user, role } = useAuth();
  const { requests, loading, error } = useLeadershipRequests(500);

  const [calls, setCalls] = useState<RtcCall[]>([]);
  const [callsLoading, setCallsLoading] = useState(true);
  const [callsError, setCallsError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<ServiceRequest | null>(null);
  const [selectedCall, setSelectedCall] = useState<RtcCall | null>(null);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | TicketDisplayStatus>('all');

  useEffect(() => {
    if (!user) return;
    const authUser = user;
    let cancelled = false;
    async function loadCalls() {
      setCallsLoading(true);
      setCallsError(null);
      try {
        const data = await fetchJsonWithFirebase<RtcCallListResponse>(authUser, '/api/calls?history=true&limit=200');
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

  const myVerifiedTickets = useMemo(
    () =>
      requests
        .filter(
          (request) =>
            request.verification_reviewed_by === profile?.id &&
            (request.verification_status === 'approved' || request.verification_status === 'rejected' || isRestored(request)),
        )
        .sort((a, b) => new Date(reviewedAt(b) || 0).getTime() - new Date(reviewedAt(a) || 0).getTime()),
    [requests, profile?.id],
  );

  const filteredVerifiedTickets = useMemo(
    () =>
      ticketStatusFilter === 'all'
        ? myVerifiedTickets
        : myVerifiedTickets.filter((request) => ticketDisplayStatus(request) === ticketStatusFilter),
    [myVerifiedTickets, ticketStatusFilter],
  );

  const myDisplayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || '';

  const myAnsweredCalls = useMemo(
    () =>
      calls
        .filter((call) => !!myDisplayName && call.accepted_by_name === myDisplayName && call.status === 'completed')
        .sort((a, b) => new Date(b.queued_at || 0).getTime() - new Date(a.queued_at || 0).getTime()),
    [calls, myDisplayName],
  );

  const verifiedToday = myVerifiedTickets.filter(
    (request) => request.verification_status === 'approved' && isToday(reviewedAt(request)),
  ).length;
  const rejectedToday = myVerifiedTickets.filter(
    (request) => request.verification_status === 'rejected' && isToday(reviewedAt(request)),
  ).length;
  const callsAnsweredToday = myAnsweredCalls.filter((call) => isToday(call.queued_at)).length;

  const fullName = myDisplayName || 'CSR Agent';
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
            <strong>{(role && positionLabels[role]) || 'CSR Agent'}</strong>
          </div>
          <div className="agent-info-card">
            <Mail size={18} />
            <span>Email</span>
            <strong>{profile?.email || 'No email found'}</strong>
          </div>
          <div className="agent-info-card">
            <Clock3 size={18} />
            <span>Last Login</span>
            <strong>{formatDateTime(getLastLogin(user))}</strong>
          </div>
        </div>
        <div className="agent-region-row">
          {profileBranches.map((branch) => <span key={branch}>{branch}</span>)}
        </div>
      </section>

      <section className="agent-panel">
        <h2>My Activity Today</h2>
        <div className="agent-stat-grid csr-agent-stat-grid">
          <div className="agent-stat-card cyan">
            <Shield size={18} />
            <strong>{verifiedToday}</strong>
            <span>Verified Today</span>
          </div>
          <div className="agent-stat-card">
            <ClipboardList size={18} />
            <strong>{rejectedToday}</strong>
            <span>Rejected</span>
          </div>
          <div className="agent-stat-card green">
            <Headphones size={18} />
            <strong>{callsAnsweredToday}</strong>
            <span>Calls Answered</span>
          </div>
        </div>
      </section>

      {error ? <div className="customer-alert">{error}</div> : null}
      {loading ? <div className="customer-alert">Loading CSR verification history...</div> : null}
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
          <div className="agent-table-head six">
            <span>Date</span>
            <span>Ticket #</span>
            <span>Name of CX</span>
            <span>Branch/Region</span>
            <span>Status</span>
            <span>Notes</span>
          </div>
          {filteredVerifiedTickets.length ? (
            <div className="agent-table-body">
              {filteredVerifiedTickets.map((request) => {
                const displayStatus = ticketDisplayStatus(request);
                return (
                  <button
                    className="agent-table-row six csr-clickable-row"
                    key={request.id}
                    onClick={() => setSelectedTicket(request)}
                    type="button"
                  >
                    <span>{formatDateTime(reviewedAt(request))}</span>
                    <strong>{ticketNo(request)}</strong>
                    <span>{request.full_name || '—'}</span>
                    <span>{request.region || '—'}</span>
                    <span className={`agent-pill ${displayStatus}`}>
                      {displayStatus}
                    </span>
                    <span>{ticketNoteText(request, displayStatus)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyRow label="No verified ticket activity found for this CSR yet." />
          )}
        </div>
        <div className="agent-table-panel csr-calls-panel">
          <h2>
            <Headphones size={16} />
            Web Calls Handled
          </h2>
          <div className="agent-table-head six">
            <span>Date</span>
            <span>Customer Name</span>
            <span>Region</span>
            <span>Status</span>
            <span>Duration</span>
            <span>Notes</span>
          </div>
          {callsLoading ? (
            <EmptyRow label="Loading call history..." />
          ) : myAnsweredCalls.length ? (
            <div className="agent-table-body">
              {myAnsweredCalls.map((call) => (
                <button
                  className="agent-table-row six csr-clickable-row"
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  type="button"
                >
                  <span>{formatDateTime(call.queued_at)}</span>
                  <strong>{call.customer_name}</strong>
                  <span>{call.branch || '—'}</span>
                  <span className="agent-pill completed">{call.status}</span>
                  <span>{formatCallDuration(call.call_duration_seconds)}</span>
                  <span>{call.notes || '—'}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyRow label="No web calls answered by this CSR yet." />
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
