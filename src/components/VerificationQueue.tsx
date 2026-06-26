'use client';

import { CheckCircle2, ListFilter, ShieldCheck, X, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import { useAuth } from '@/components/AuthProvider';
import type { ServiceRequest } from '@/lib/types';

type DetailValue = string | number | boolean | null | undefined;
type DetailSection = { title: string; rows: [string, DetailValue][] };

function empty(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
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
}: {
  request: ServiceRequest;
  onClose: () => void;
  onApprove: (request: ServiceRequest) => void;
  onReject: (request: ServiceRequest) => void;
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
      </div>
    </div>
  );
}

export function VerificationQueue() {
  const { user } = useAuth();
  const [allRequests, setAllRequests] = useState<ServiceRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ServiceRequest[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');
  const [postingId, setPostingId] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const [allData, pendingData] = await Promise.all([
        fetchJsonWithFirebase<{ requests: ServiceRequest[] }>(user, '/api/service-requests?limit=150'),
        fetchJsonWithFirebase<{ requests: ServiceRequest[] }>(user, '/api/service-requests?verification_status=pending&limit=150'),
      ]);
      setAllRequests(allData.requests);
      setPendingRequests(pendingData.requests);
      setSelectedIds([]);
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Unable to load verification queue.');
    } finally {
      setLoading(false);
    }
  }

  async function review(request: ServiceRequest, action: 'approve' | 'reject') {
    if (!user) return;
    const rejectReason = action === 'reject' ? window.prompt('Reject reason') : '';
    if (action === 'reject' && !rejectReason) return;

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
    for (const request of selected) {
      await review(request, action);
    }
  }

  useEffect(() => {
    void load();
  }, [user]);

  const regions = useMemo(() => {
    const list = Array.from(new Set(pendingRequests.map((request) => request.region).filter(Boolean) as string[]));
    return list.sort((a, b) => a.localeCompare(b));
  }, [pendingRequests]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return pendingRequests.filter((request) => {
      if (status !== 'pending' && request.verification_status !== status) return false;
      if (region !== 'all' && request.region !== region) return false;
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
  }, [pendingRequests, region, search, status]);

  const stats = useMemo(() => ({
    pending: allRequests.filter((request) => request.verification_status === 'pending').length,
    approved: allRequests.filter((request) => request.verification_status === 'approved').length,
    rejected: allRequests.filter((request) => request.verification_status === 'rejected').length,
  }), [allRequests]);

  const allShownSelected = visible.length > 0 && visible.every((request) => selectedIds.includes(request.id));
  const approvedWaiting = allRequests.filter((request) => request.verification_status === 'approved' && !request.er_ticket_id);

  return (
    <div className="manager-dashboard php-manager-page manager-verification-page">
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
        <div className="field wide"><label>Branch / Region</label><select value={region} onChange={(event) => setRegion(event.target.value)}><option value="all">All Branches</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}</select><small>Default view is all pending verification requests. Use this dropdown to narrow by branch.</small></div>
        <button className="btn btn-primary" onClick={load} type="button"><ListFilter size={16} /> Apply Filter</button>
      </section>

      <section className="manager-batch-bar">
        <label>
          <input
            checked={allShownSelected}
            onChange={(event) => setSelectedIds(event.target.checked ? visible.map((request) => request.id) : [])}
            type="checkbox"
          />
          Select all shown pending tickets
        </label>
        <span>{selectedIds.length} selected</span>
        <button className="btn manager-approve" disabled={!selectedIds.length} onClick={() => void reviewSelected('approve')} type="button"><CheckCircle2 size={16} /> Approve Selected</button>
        <button className="btn btn-danger" disabled={!selectedIds.length} onClick={() => void reviewSelected('reject')} type="button"><XCircle size={16} /> Reject Selected</button>
      </section>

      <section className="manager-table-panel flush">
        <div className="manager-table-wrap er-ticket-table-scroll verification-table-scroll">
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
              {visible.map((request) => (
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
                  <td>{empty(request.full_name)}</td>
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
              {!visible.length ? <tr><td colSpan={19} className="manager-empty-cell">{loading ? 'Loading verification queue...' : 'No pending verification requests found.'}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRequest ? (
        <VerificationDetailsModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onApprove={(request) => void review(request, 'approve')}
          onReject={(request) => void review(request, 'reject')}
        />
      ) : null}
    </div>
  );
}
