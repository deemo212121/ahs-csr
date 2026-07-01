'use client';

import { CheckCircle2, ChevronLeft, ChevronRight, Copy, ListFilter, RotateCcw, ShieldCheck, X, XCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useLiveUpdate } from '@/lib/notifications/useLiveUpdate';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import { useAuth } from '@/components/AuthProvider';
import { StickyHorizontalScroll } from '@/components/StickyHorizontalScroll';
import type { ServiceRequest } from '@/lib/types';
import { BRANCHES } from '@/lib/branches';
import { BranchCheckboxDropdown } from '@/components/BranchCheckboxDropdown';
import { useBranchFilter } from '@/lib/useBranchFilter';
import { isPresenceOnline, usePresenceMap } from '@/lib/presence/usePresenceMap';

type DetailValue = string | number | boolean | null | undefined;
type DetailSection = { title: string; rows: [string, DetailValue][] };
type Section = 'queue' | 'related' | 'restore';

function isSection(value: string | null): value is Section {
  return value === 'queue' || value === 'related' || value === 'restore';
}

function empty(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function normalize(value?: string | number | null) {
  return String(value ?? '').trim().toLowerCase();
}

function formatSubmitted(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function dateOnly(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function fullAddress(request: ServiceRequest) {
  const line = [request.service_address, request.service_address_2].filter(Boolean).join(' ');
  const area = [request.city, request.state, request.zip_code].filter(Boolean).join(', ');
  return [line, area].filter(Boolean).join(' · ') || '—';
}

function sourceText(request: ServiceRequest) {
  if (request.origin_type) return request.origin_type;
  if (request.ticket_source === 'cx_online') return 'Customer App';
  if (request.ticket_source === 'csr_manual') return 'Manual Ticket';
  return request.ticket_source || 'Customer App';
}

function preferredSchedule(request: ServiceRequest) {
  return [dateOnly(request.preferred_date), request.preferred_time].filter((item) => item && item !== '—').join(' · ') || '—';
}

function ticketBoardNo(ticket: ServiceRequest) {
  return ticket.er_ticket?.ticket_no || ticket.request_number || '—';
}

type RelatedMatch = { ticket: ServiceRequest; matchedFields: string[] };

// Detect potential duplicate tickets on the live branch ticket board by comparing
// customer name, email, phone, product, manufacturer, model, and serial number.
function findRelatedTickets(request: ServiceRequest, ticketBoard: ServiceRequest[]): RelatedMatch[] {
  const phone = normalize(request.phone_number);
  const email = normalize(request.customer_email);
  const name = normalize(request.full_name);
  const product = normalize(request.manual_appliance_type);
  const brand = normalize(request.manual_brand);
  const model = normalize(request.model_number);
  const serial = normalize(request.serial_number);

  const matches: RelatedMatch[] = [];

  for (const ticket of ticketBoard) {
    const er = ticket.er_ticket;
    const tPhone = normalize(er?.customer_phone);
    const tEmail = normalize(er?.customer_email);
    const tName = normalize(er?.customer_name || ticket.full_name);
    const tProduct = normalize(er?.product_type);
    const tBrand = normalize(er?.manufacturer);
    const tModel = normalize(er?.model);
    const tSerial = normalize(er?.serial);

    // Priority fields for flagging, in order: Serial, Name, Phone. All other
    // fields are collected only for display and don't count toward flagging.
    const matchedFields: string[] = [];
    if (serial && serial === tSerial) matchedFields.push('Serial');
    if (name && name === tName) matchedFields.push('Name');
    if (phone && phone === tPhone) matchedFields.push('Phone');
    if (email && email === tEmail) matchedFields.push('Email');
    if (product && product === tProduct) matchedFields.push('Product');
    if (brand && brand === tBrand) matchedFields.push('Manufacturer');
    if (model && model === tModel) matchedFields.push('Model');

    // Flag as a potential duplicate only when all 3 priority fields (serial,
    // name, phone) match — the minimum requirement of 3 matches.
    const priorityMatch = matchedFields.includes('Serial') && matchedFields.includes('Name') && matchedFields.includes('Phone');
    if (priorityMatch) {
      matches.push({ ticket, matchedFields });
    }
  }

  return matches;
}

function DetailRow({ label, value }: { label: string; value?: DetailValue }) {
  return (
    <div className="er-ticket-detail-row">
      <span>{label}</span>
      <strong>{empty(value)}</strong>
    </div>
  );
}

function VerificationDetailsModal({
  request,
  onClose,
  onApprove,
  onReject,
  onViewRelated,
}: {
  request: ServiceRequest;
  onClose: () => void;
  onApprove: (request: ServiceRequest) => void;
  onReject: (request: ServiceRequest) => void;
  onViewRelated: (request: ServiceRequest) => void;
}) {
  const sections = useMemo<DetailSection[]>(() => ([
    {
      title: 'Request / Verification',
      rows: [
        ['Ticket No', request.request_number],
        ['Verification Status', request.verification_status],
        ['Sync Status', request.sync_status],
        ['ER Ticket ID', request.er_ticket_id],
        ['Source', sourceText(request)],
        ['Warranty', request.warranty_type],
        ['Submitted', formatSubmitted(request.requested_at)],
        ['Last Updated', formatSubmitted(request.updated_at)],
        ['Reject Reason', request.verification_reject_reason],
        ['Verification Notes', request.verification_notes],
      ],
    },
    {
      title: 'Customer Information',
      rows: [
        ['Customer Name', request.full_name],
        ['Phone', request.phone_number],
        ['Secondary Phone', request.secondary_phone],
        ['Email', request.customer_email],
        ['Service Address', fullAddress(request)],
        ['Address Line 2', request.service_address_2],
        ['City', request.city],
        ['State', request.state],
        ['ZIP', request.zip_code],
        ['Landmark / Address Note', request.landmark],
      ],
    },
    {
      title: 'Product / Appliance',
      rows: [
        ['Product', request.manual_appliance_type],
        ['Manufacturer / Brand', request.manual_brand],
        ['Model', request.model_number],
        ['Model Version', request.product_model_version],
        ['Serial', request.serial_number],
        ['Purchase Date', dateOnly(request.purchase_date)],
      ],
    },
    {
      title: 'Schedule / Request Details',
      rows: [
        ['Preferred Schedule', preferredSchedule(request)],
        ['Preferred Date', dateOnly(request.preferred_date)],
        ['Preferred Time', request.preferred_time],
        ['Branch / Region', request.region],
        ['Issue Description', request.issue_description],
        ['Special Request / Internal Note', request.special_request],
      ],
    },
  ]), [request]);

  return (
    <div className="er-ticket-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Verification request ${request.request_number} details`}>
      <div className="er-ticket-modal-card">
        <div className="er-ticket-modal-head">
          <div>
            <span>Verification Request Details</span>
            <h3>{request.request_number}</h3>
            <p>Review the full customer-submitted request before approving it for ER ticket posting.</p>
          </div>
          <button className="er-ticket-modal-close" onClick={onClose} type="button" aria-label="Close request details">
            <X size={18} />
          </button>
        </div>
        <div className="er-ticket-modal-body">
          {sections.map((section) => (
            <section className="er-ticket-detail-section" key={section.title}>
              <h4>{section.title}</h4>
              <div className="er-ticket-detail-grid">
                {section.rows.map(([label, value]) => (
                  <DetailRow key={label} label={label} value={value} />
                ))}
              </div>
            </section>
          ))}
          {request.verification_status === 'pending' ? (
            <div className="verification-modal-actions">
              <button className="manager-approve" onClick={() => onApprove(request)} type="button"><CheckCircle2 size={16} /> Approve Request</button>
              <button className="btn-danger" onClick={() => onReject(request)} type="button"><XCircle size={16} /> Reject Request</button>
            </div>
          ) : null}
        </div>
        <div className="verification-modal-footer">
          <button className="btn btn-secondary" onClick={() => onViewRelated(request)} type="button">
            <Copy size={15} /> Related Tickets
          </button>
        </div>
      </div>
    </div>
  );
}

export function VerificationQueue() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [allRequests, setAllRequests] = useState<ServiceRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ServiceRequest[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<ServiceRequest[]>([]);
  const [ticketBoard, setTicketBoard] = useState<ServiceRequest[]>([]);
  const [ticketBoardLoading, setTicketBoardLoading] = useState(false);
  const [ticketBoardLoaded, setTicketBoardLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');
  const [postingId, setPostingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('queue');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [relatedFocusRequest, setRelatedFocusRequest] = useState<ServiceRequest | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const [allData, pendingData, rejectedData] = await Promise.all([
        fetchJsonWithFirebase<{ requests: ServiceRequest[] }>(user, '/api/service-requests?limit=150'),
        fetchJsonWithFirebase<{ requests: ServiceRequest[] }>(user, '/api/service-requests?verification_status=pending&limit=150'),
        fetchJsonWithFirebase<{ requests: ServiceRequest[] }>(user, '/api/service-requests?verification_status=rejected&limit=150'),
      ]);
      setAllRequests(allData.requests);
      setPendingRequests(pendingData.requests);
      setRejectedRequests(rejectedData.requests);
      setSelectedIds([]);
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Unable to load verification queue.');
    } finally {
      setLoading(false);
    }
  }

  async function loadTicketBoard() {
    if (!user) return;
    setTicketBoardLoading(true);
    try {
      const data = await fetchJsonWithFirebase<{ requests: ServiceRequest[] }>(user, '/api/service-requests?view=tickets&limit=500');
      setTicketBoard(data.requests);
      setTicketBoardLoaded(true);
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Unable to load the branch ticket list.');
    } finally {
      setTicketBoardLoading(false);
    }
  }

  async function review(request: ServiceRequest, action: 'approve' | 'reject', options: { skipConfirm?: boolean } = {}) {
    if (!user) return;
    const rejectReason = action === 'reject' ? window.prompt('Reject reason') : '';
    if (action === 'reject' && !rejectReason) return;

    if (!options.skipConfirm) {
      const confirmed = window.confirm(`Are you sure you want to ${action} ${request.request_number}?`);
      if (!confirmed) return;
    }

    try {
      const result = await fetchJsonWithFirebase<{
        request: ServiceRequest;
        sync?: { ok: boolean; mode: string; erTicketId: string | null; message: string } | null;
      }>(user, `/api/service-requests/${request.id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          reject_reason: rejectReason,
          notes: action === 'approve' ? 'Request verified and approved.' : '',
        }),
      });

      if (action === 'approve') {
        setMessageTone('success');
        setMessage(result.sync?.message || `${request.request_number} approved and posted into ER tickets.`);
      } else {
        setMessageTone('success');
        setMessage(`${request.request_number} rejected.`);
      }

      setSelectedRequest(null);
      await load();
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : `Unable to ${action} ${request.request_number}.`);
      await load();
    }
  }

  async function restoreRequest(request: ServiceRequest) {
    if (!user) return;
    const confirmed = window.confirm(`Are you sure you want to restore ${request.request_number} to pending?`);
    if (!confirmed) return;
    setRestoringId(request.id);
    try {
      await fetchJsonWithFirebase(user, `/api/service-requests/${request.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ action: 'restore' }),
      });
      setMessageTone('success');
      setMessage(`${request.request_number} restored to pending for re-review.`);
      await load();
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : `Unable to restore ${request.request_number}.`);
    } finally {
      setRestoringId(null);
    }
  }

  async function postApprovedToErTicket(request: ServiceRequest) {
    if (!user) return;
    setPostingId(request.id);
    try {
      const result = await fetchJsonWithFirebase<{
        request?: ServiceRequest;
        sync?: { ok: boolean; mode: string; erTicketId: string | null; message: string } | null;
      }>(user, `/api/service-requests/${request.id}/sync-er`, { method: 'POST' });
      setMessageTone('success');
      setMessage(result.sync?.message || `${request.request_number} posted into ER tickets.`);
      await load();
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : `Unable to post ${request.request_number} into ER tickets.`);
      await load();
    } finally {
      setPostingId(null);
    }
  }

  async function reviewSelected(action: 'approve' | 'reject') {
    const selected = pendingRequests.filter((request) => selectedIds.includes(request.id));
    if (!selected.length) return;
    const confirmed = window.confirm(`Are you sure you want to ${action} ${selected.length} selected ticket${selected.length > 1 ? 's' : ''}?`);
    if (!confirmed) return;
    for (const request of selected) {
      await review(request, action, { skipConfirm: true });
    }
  }

  useEffect(() => {
    void load();
  }, [user]);

  useEffect(() => {
    const requested = searchParams.get('section');
    if (isSection(requested)) setSection(requested);
  }, [searchParams]);

  useEffect(() => {
    if (section === 'related' && !ticketBoardLoaded && !ticketBoardLoading) {
      void loadTicketBoard();
    }
  }, [section, ticketBoardLoaded, ticketBoardLoading]);

  useLiveUpdate('verify', () => { void load(); });

  const branchOptions = useMemo(() => [...BRANCHES], []);
  const { selectedBranches, setSelectedBranches } = useBranchFilter();

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return pendingRequests.filter((request) => {
      if (status !== 'pending' && request.verification_status !== status) return false;
      if (!selectedBranches.length || !selectedBranches.includes(request.region || '')) return false;
      if (!term) return true;
      return [
        request.request_number,
        request.full_name,
        request.phone_number,
        request.secondary_phone,
        request.customer_email,
        request.service_address,
        request.service_address_2,
        request.city,
        request.region,
        request.state,
        request.zip_code,
        request.manual_appliance_type,
        request.manual_brand,
        request.model_number,
        request.serial_number,
        request.warranty_type,
        request.issue_description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [pendingRequests, selectedBranches, search, status]);

  const customerIds = useMemo(
    () => pendingRequests.map((request) => request.customer_id).filter((id): id is string => !!id),
    [pendingRequests],
  );
  const presenceMap = usePresenceMap(user, customerIds);

  const prioritizedVisible = useMemo(
    () =>
      [...visible].sort((a, b) => {
        const aOnline = a.customer_id ? isPresenceOnline(presenceMap[a.customer_id]) : false;
        const bOnline = b.customer_id ? isPresenceOnline(presenceMap[b.customer_id]) : false;
        if (aOnline === bOnline) return 0;
        return aOnline ? -1 : 1;
      }),
    [visible, presenceMap],
  );

  function viewRelatedTickets(request: ServiceRequest) {
    setRelatedFocusRequest(request);
    setSection('related');
    setSelectedRequest(null);
  }

  const focusedRelatedMatches = useMemo(() => {
    if (!relatedFocusRequest || !ticketBoard.length) return null;
    return findRelatedTickets(relatedFocusRequest, ticketBoard);
  }, [relatedFocusRequest, ticketBoard]);

  const relatedResults = useMemo(() => {
    if (!ticketBoard.length) return [];
    return pendingRequests
      .map((request) => ({ request, matches: findRelatedTickets(request, ticketBoard) }))
      .filter((entry) => entry.matches.length > 0);
  }, [pendingRequests, ticketBoard]);

  const stats = useMemo(() => ({
    pending: allRequests.filter((request) => request.verification_status === 'pending').length,
    approved: allRequests.filter((request) => request.verification_status === 'approved').length,
    rejected: allRequests.filter((request) => request.verification_status === 'rejected').length,
  }), [allRequests]);

  const allShownSelected = prioritizedVisible.length > 0 && prioritizedVisible.every((request) => selectedIds.includes(request.id));
  const approvedWaiting = allRequests.filter((request) => request.verification_status === 'approved' && !request.er_ticket_id);

  const navItems: { key: Section; label: string; icon: typeof ShieldCheck; count?: number }[] = [
    { key: 'queue', label: 'Verification Queue', icon: ShieldCheck, count: stats.pending },
    { key: 'related', label: 'Related Tickets', icon: Copy, count: relatedResults.length || undefined },
    { key: 'restore', label: 'Restore Rejected Tickets', icon: RotateCcw, count: rejectedRequests.length },
  ];

  return (
    <div className="manager-dashboard php-manager-page manager-verification-page verification-page-with-sidebar">
      <aside className={`verification-side-nav ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <button
          aria-label={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
          className="verification-side-nav-toggle"
          onClick={() => setSidebarCollapsed((current) => !current)}
          type="button"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`verification-side-nav-item ${section === item.key ? 'active' : ''}`}
                key={item.key}
                onClick={() => {
                  setSection(item.key);
                  if (item.key === 'related') setRelatedFocusRequest(null);
                }}
                title={item.label}
                type="button"
              >
                <Icon size={18} />
                {!sidebarCollapsed ? <span>{item.label}</span> : null}
                {!sidebarCollapsed && item.count ? <b>{item.count}</b> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="verification-page-content">
        <section className="manager-page-title-row">
          <div>
            <h1><ShieldCheck size={38} /> Verification Queue</h1>
            <p>Review customer-submitted requests. Approved requests are saved in ER portal_service_requests and immediately posted into the live ER tickets table.</p>
          </div>
          <a className="btn btn-secondary" href="/manager/tickets">Tickets</a>
        </section>

        <section className="manager-ticket-stats three">
          <div><strong>{stats.pending}</strong><span>Pending Review</span></div>
          <div><strong>{stats.approved}</strong><span>Approved</span></div>
          <div><strong>{stats.rejected}</strong><span>Rejected</span></div>
        </section>

        {message ? <div className={messageTone === 'error' ? 'danger-text' : 'success-text'}>{message}</div> : null}

        {section === 'queue' ? (
          <>
            {approvedWaiting.length ? (
              <section className="manager-er-sync-panel">
                <div>
                  <strong>{approvedWaiting.length} approved request{approvedWaiting.length > 1 ? 's' : ''} still need{approvedWaiting.length > 1 ? '' : 's'} ER ticket posting.</strong>
                  <span>Use this to post older approved requests into the live ER tickets table.</span>
                </div>
                <div className="manager-er-sync-actions">
                  {approvedWaiting.slice(0, 5).map((request) => (
                    <button
                      className="btn btn-secondary"
                      disabled={postingId === request.id}
                      key={request.id}
                      onClick={() => void postApprovedToErTicket(request)}
                      type="button"
                    >
                      {postingId === request.id ? 'Posting...' : `Post ${request.request_number}`}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="manager-verification-filters">
              <div className="field"><label>Search</label><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ticket, name, phone, email, city, product, model, serial" /></div>
              <div className="field"><label>Status</label><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="pending">Pending</option></select></div>
              <div className="field wide">
                <label>Branch / Region</label>
                <BranchCheckboxDropdown branches={branchOptions} selectedBranches={selectedBranches} onChange={setSelectedBranches} />
              </div>
              <button className="btn btn-primary" onClick={load} type="button"><ListFilter size={16} /> Apply Filter</button>
            </section>

            <section className="manager-batch-bar">
              <label>
                <input
                  checked={allShownSelected}
                  onChange={(event) => setSelectedIds(event.target.checked ? prioritizedVisible.map((request) => request.id) : [])}
                  type="checkbox"
                />
                Select all shown pending tickets
              </label>
              <span>{selectedIds.length} selected</span>
              <button className="btn manager-approve" disabled={!selectedIds.length} onClick={() => void reviewSelected('approve')} type="button"><CheckCircle2 size={16} /> Approve Selected</button>
              <button className="btn btn-danger" disabled={!selectedIds.length} onClick={() => void reviewSelected('reject')} type="button"><XCircle size={16} /> Reject Selected</button>
            </section>

            <section className="manager-table-panel flush">
              <StickyHorizontalScroll className="manager-table-wrap er-ticket-table-scroll verification-table-scroll">
                <table className="manager-data-table manager-verification-table er-ticket-list-table detailed-verification-table">
                  <thead>
                    <tr>
                      <th />
                      <th>Ticket No</th>
                      <th>Wty</th>
                      <th>Source</th>
                      <th>Cx Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>City</th>
                      <th>Loc</th>
                      <th>Product</th>
                      <th>Brand</th>
                      <th>Model</th>
                      <th>Serial</th>
                      <th>Purchase Date</th>
                      <th>Preferred</th>
                      <th>Submitted</th>
                      <th>Sync</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prioritizedVisible.map((request) => (
                      <tr key={request.id}>
                        <td>
                          <input checked={selectedIds.includes(request.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, request.id] : current.filter((id) => id !== request.id))} type="checkbox" />
                        </td>
                        <td>
                          <button className="er-ticket-no-button" onClick={() => setSelectedRequest(request)} type="button">
                            {request.request_number}
                          </button>
                        </td>
                        <td>{empty(request.warranty_type)}</td>
                        <td>{empty(sourceText(request))}</td>
                        <td>
                          <span
                            className={`verification-presence-dot ${request.customer_id && isPresenceOnline(presenceMap[request.customer_id]) ? 'online' : 'offline'}`}
                            title={request.customer_id && isPresenceOnline(presenceMap[request.customer_id]) ? 'Customer is online' : 'Customer is offline'}
                          />
                          {empty(request.full_name)}
                        </td>
                        <td>{empty(request.phone_number)}</td>
                        <td>{empty(request.customer_email)}</td>
                        <td>{empty(request.city)}</td>
                        <td>{empty(request.region)}</td>
                        <td>{empty(request.manual_appliance_type)}</td>
                        <td>{empty(request.manual_brand)}</td>
                        <td>{empty(request.model_number)}</td>
                        <td>{empty(request.serial_number)}</td>
                        <td>{dateOnly(request.purchase_date)}</td>
                        <td>{preferredSchedule(request)}</td>
                        <td>{formatSubmitted(request.requested_at)}</td>
                        <td>{empty(request.sync_status)}</td>
                        <td><span className="manager-status-pill new">Pending</span></td>
                        <td>
                          <div className="manager-stack-actions">
                            <button className="manager-approve" onClick={() => review(request, 'approve')} type="button"><CheckCircle2 size={15} /> Approve</button>
                            <button className="btn-danger" onClick={() => review(request, 'reject')} type="button"><XCircle size={15} /> Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!prioritizedVisible.length ? <tr><td colSpan={19} className="manager-empty-cell">{loading ? 'Loading verification queue...' : 'No pending verification requests found.'}</td></tr> : null}
                  </tbody>
                </table>
              </StickyHorizontalScroll>
            </section>
          </>
        ) : null}

        {section === 'related' ? (
          <section className="manager-table-panel flush">
            <div className="manager-table-headline">
              <div>
                <h2><Copy size={17} /> Related Tickets</h2>
                <p>
                  {relatedFocusRequest
                    ? `Showing potential duplicates for ${relatedFocusRequest.request_number} only.`
                    : 'Pending requests cross-checked against the live branch ticket list for potential duplicates by customer name, email, phone, product, manufacturer, model, and serial.'}
                </p>
              </div>
              <div className="button-row">
                {relatedFocusRequest ? (
                  <button className="btn btn-secondary" onClick={() => setRelatedFocusRequest(null)} type="button">
                    Show All Pending
                  </button>
                ) : (
                  <span>{relatedResults.length} flagged</span>
                )}
              </div>
            </div>
            {ticketBoardLoading ? (
              <div className="manager-empty-cell">Loading the branch ticket list to compare against...</div>
            ) : (relatedFocusRequest ? [{ request: relatedFocusRequest, matches: focusedRelatedMatches || [] }] : relatedResults).some((entry) => entry.matches.length > 0) ? (
              <div className="verification-related-list">
                {(relatedFocusRequest ? [{ request: relatedFocusRequest, matches: focusedRelatedMatches || [] }] : relatedResults).map(({ request, matches }) => (
                  <div className="verification-related-card" key={request.id}>
                    <div className="verification-related-source">
                      <span className="er-columns-pill">Pending Request</span>
                      <button className="er-ticket-no-button" onClick={() => setSelectedRequest(request)} type="button">{request.request_number}</button>
                      <strong>{empty(request.full_name)}</strong>
                      <span>{empty(request.phone_number)} · {empty(request.customer_email)}</span>
                      <span>{empty(request.manual_brand)} {empty(request.manual_appliance_type)} {empty(request.model_number)}</span>
                    </div>
                    <div className="verification-related-matches">
                      {matches.map(({ ticket, matchedFields }) => (
                        <div className="verification-related-match-row" key={ticket.id}>
                          <span className="er-columns-pill">Existing Ticket</span>
                          <strong>{ticketBoardNo(ticket)}</strong>
                          <span>{empty(ticket.er_ticket?.customer_name || ticket.full_name)}</span>
                          <span>{empty(ticket.er_ticket?.customer_phone)} · {empty(ticket.er_ticket?.customer_email)}</span>
                          <div className="verification-related-tags">
                            {matchedFields.map((field) => <b key={field}>{field} match</b>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="manager-empty-cell">
                {relatedFocusRequest
                  ? `No potential duplicate tickets found for ${relatedFocusRequest.request_number}.`
                  : 'No potential duplicate tickets found for the current pending requests.'}
              </div>
            )}
          </section>
        ) : null}

        {section === 'restore' ? (
          <section className="manager-table-panel flush">
            <div className="manager-table-headline">
              <div>
                <h2><RotateCcw size={17} /> Restore Rejected Tickets</h2>
                <p>Restore a rejected request back to pending if it was rejected in error.</p>
              </div>
              <div className="button-row"><span>{rejectedRequests.length} rejected</span></div>
            </div>
            <StickyHorizontalScroll className="manager-table-wrap er-ticket-table-scroll">
              <table className="manager-data-table er-ticket-list-table">
                <thead>
                  <tr>
                    <th>Ticket No</th>
                    <th>Cx Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Reject Reason</th>
                    <th>Rejected At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedRequests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <button className="er-ticket-no-button" onClick={() => setSelectedRequest(request)} type="button">
                          {request.request_number}
                        </button>
                      </td>
                      <td>{empty(request.full_name)}</td>
                      <td>{empty(request.phone_number)}</td>
                      <td>{empty(request.customer_email)}</td>
                      <td>{empty(request.verification_reject_reason)}</td>
                      <td>{formatSubmitted(request.updated_at)}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          disabled={restoringId === request.id}
                          onClick={() => void restoreRequest(request)}
                          type="button"
                        >
                          <RotateCcw size={15} /> {restoringId === request.id ? 'Restoring...' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!rejectedRequests.length ? <tr><td colSpan={7} className="manager-empty-cell">{loading ? 'Loading rejected requests...' : 'No rejected requests found.'}</td></tr> : null}
                </tbody>
              </table>
            </StickyHorizontalScroll>
          </section>
        ) : null}
      </div>

      {selectedRequest ? (
        <VerificationDetailsModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onApprove={(request) => void review(request, 'approve')}
          onReject={(request) => void review(request, 'reject')}
          onViewRelated={viewRelatedTickets}
        />
      ) : null}
    </div>
  );
}
