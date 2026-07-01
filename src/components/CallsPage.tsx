'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  ClipboardPlus,
  FileAudio,
  Headphones,
  Info,
  MapPin,
  PhoneCall,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import type { RtcCall, RtcCallListResponse, RtcCallStatus } from '@/lib/calls/types';
import { WebRtcCallRoom } from '@/components/calls/WebRtcCallRoom';
import { useLiveUpdate } from '@/lib/notifications/useLiveUpdate';

type ServiceAreasResponse = {
  service_areas?: Array<{ region?: string | null; location?: string | null }>;
  locations?: Array<{ location?: string | null }>;
};

const statusOptions: Array<{ value: 'open' | RtcCallStatus | 'history'; label: string }> = [
  { value: 'open', label: 'Open calls' },
  { value: 'manager_queue', label: 'Waiting' },
  { value: 'accepted', label: 'In room' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'history', label: 'All recent' },
];

function timeAgo(value?: string | null) {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return '—';
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(value).toLocaleDateString();
}

function statusLabel(status: RtcCallStatus) {
  if (status === 'manager_queue') return 'Waiting';
  if (status === 'accepted') return 'In room';
  return status.replace('_', ' ');
}

function roleHeadline(role: string | null) {
  if (role === 'team_leader') return { title: 'Team Web Calls', subtitle: 'Monitor branch demand, claim urgent calls, and support CSR agents when the queue spikes.' };
  if (role === 'csr_manager') return { title: 'Manager Call Command', subtitle: 'Live customer call queue with branch routing, staff claim history, and WebRTC audio rooms.' };
  return { title: 'CSR Web Call Desk', subtitle: 'Answer customer web calls, filter by branch, and keep the queue moving.' };
}

function cleanBranch(value?: string | null) {
  return value?.trim() || '';
}

type QuickManualForm = {
  request_number: string;
  fake_ticket: boolean;
  ticket_source: string;
  full_name: string;
  phone_number: string;
  secondary_phone: string;
  customer_email: string;
  service_address: string;
  service_address_2: string;
  region: string;
  city: string;
  state: string;
  zip_code: string;
  landmark: string;
  manual_appliance_type: string;
  manual_brand: string;
  model_number: string;
  serial_number: string;
  product_model_version: string;
  purchase_date: string;
  preferred_date: string;
  preferred_time_slot: string;
  warranty_type: string;
  issue_description: string;
  special_request: string;
};

function quickManualInitial(call: RtcCall | null): QuickManualForm {
  return {
    request_number: '',
    fake_ticket: false,
    ticket_source: 'Phone Call',
    full_name: call?.customer_name || '',
    phone_number: call?.phone_number || '',
    secondary_phone: '',
    customer_email: call?.customer_email || '',
    service_address: '',
    service_address_2: '',
    region: call?.branch || '',
    city: call?.city || '',
    state: call?.state || '',
    zip_code: call?.zip_code || '',
    landmark: '',
    manual_appliance_type: '',
    manual_brand: '',
    model_number: '',
    serial_number: '',
    product_model_version: '',
    purchase_date: '',
    preferred_date: '',
    preferred_time_slot: '',
    warranty_type: '',
    issue_description: call ? `Web call with ${call.customer_name}. ${call.call_reason || ''}`.trim() : '',
    special_request: call ? `Created while handling web call ${call.id}.` : '',
  };
}

function QuickManualTicketPanel({
  call,
  onClose,
}: {
  call: RtcCall | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<QuickManualForm>(() => quickManualInitial(call));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(quickManualInitial(call));
    setMessage(null);
    setError(null);
  }, [call?.id]);

  function update<K extends keyof QuickManualForm>(key: K, value: QuickManualForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const phone = form.phone_number.trim() || 'WebRTC audio only';
      const data = await fetchJsonWithFirebase<{ request: { request_number: string } }>(user, '/api/service-requests', {
        method: 'POST',
        body: JSON.stringify({
          full_name: form.full_name,
          phone_number: phone,
          secondary_phone: form.secondary_phone,
          customer_email: form.customer_email,
          request_number: form.request_number,
          fake_ticket: form.fake_ticket,
          ticket_source: form.ticket_source === 'Phone Call' ? 'csr_manual_phone_call' : 'csr_manual',
          service_address: form.service_address,
          service_address_2: form.service_address_2,
          city: form.city,
          region: form.region,
          state: form.state,
          zip_code: form.zip_code,
          landmark: form.landmark,
          manual_appliance_type: form.manual_appliance_type,
          manual_brand: form.manual_brand,
          model_number: form.model_number,
          serial_number: form.serial_number,
          product_model_version: form.product_model_version,
          purchase_date: form.purchase_date,
          preferred_date: form.preferred_date,
          preferred_time_slot: form.preferred_time_slot,
          warranty_type: form.warranty_type,
          issue_description: form.issue_description,
          special_request: form.special_request,
        }),
      });
      setMessage(`Manual ticket created: ${data.request.request_number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create manual ticket.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="call-manual-backdrop" role="presentation" onClick={onClose}>
      <section className="call-manual-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="call-eyebrow"><ClipboardPlus size={14} /> Create while on call</span>
            <h2>Quick Manual Ticket</h2>
            <p>{call ? `Prefilled from ${call.customer_name}'s web call.` : 'Create a ticket without leaving the call queue.'}</p>
          </div>
          <button aria-label="Close manual ticket panel" onClick={onClose} type="button"><X size={18} /></button>
        </header>

        {message ? <div className="success-text">{message}</div> : null}
        {error ? <div className="call-room-alert">{error}</div> : null}

        <form className="call-manual-form" onSubmit={submit}>
          <label>Ticket No<input value={form.request_number} onChange={(event) => update('request_number', event.target.value)} placeholder="Auto if blank" /></label>
          <label>Source<select value={form.ticket_source} onChange={(event) => update('ticket_source', event.target.value)}><option>Phone Call</option><option>Customer Follow-up</option><option>Email</option><option>CSR Manual</option></select></label>
          <label className="manual-checkbox call-manual-check"><input checked={form.fake_ticket} onChange={(event) => update('fake_ticket', event.target.checked)} type="checkbox" /> Fake Ticket</label>
          <label>Name *<input required value={form.full_name} onChange={(event) => update('full_name', event.target.value)} /></label>
          <label>Phone / WebRTC Contact<input value={form.phone_number} onChange={(event) => update('phone_number', event.target.value)} placeholder="Optional for WebRTC" /></label>
          <label>Secondary Phone<input value={form.secondary_phone} onChange={(event) => update('secondary_phone', event.target.value)} /></label>
          <label>Email<input type="email" value={form.customer_email} onChange={(event) => update('customer_email', event.target.value)} /></label>
          <label>Branch<input value={form.region} onChange={(event) => update('region', event.target.value)} /></label>
          <label>City<input value={form.city} onChange={(event) => update('city', event.target.value)} /></label>
          <label>State<input value={form.state} onChange={(event) => update('state', event.target.value)} /></label>
          <label>ZIP *<input required value={form.zip_code} onChange={(event) => update('zip_code', event.target.value.replace(/\D/g, '').slice(0, 5))} /></label>
          <label className="wide">Service Address *<input required value={form.service_address} onChange={(event) => update('service_address', event.target.value)} placeholder="Customer service address" /></label>
          <label className="wide">Address Line 2<input value={form.service_address_2} onChange={(event) => update('service_address_2', event.target.value)} /></label>
          <label className="wide">Address Note<input value={form.landmark} onChange={(event) => update('landmark', event.target.value)} /></label>
          <label>Appliance *<input required value={form.manual_appliance_type} onChange={(event) => update('manual_appliance_type', event.target.value)} placeholder="Refrigerator, washer..." /></label>
          <label>Brand *<input required value={form.manual_brand} onChange={(event) => update('manual_brand', event.target.value)} placeholder="GE, Samsung..." /></label>
          <label>Model<input value={form.model_number} onChange={(event) => update('model_number', event.target.value)} /></label>
          <label>Serial<input value={form.serial_number} onChange={(event) => update('serial_number', event.target.value)} /></label>
          <label>Version<input value={form.product_model_version} onChange={(event) => update('product_model_version', event.target.value)} /></label>
          <label>Purchase Date<input type="date" value={form.purchase_date} onChange={(event) => update('purchase_date', event.target.value)} /></label>
          <label>Preferred Date<input type="date" value={form.preferred_date} onChange={(event) => update('preferred_date', event.target.value)} /></label>
          <label>Preferred Time<select value={form.preferred_time_slot} onChange={(event) => update('preferred_time_slot', event.target.value)}><option value="">Select time</option><option>AM</option><option>PM</option></select></label>
          <label>Warranty<select value={form.warranty_type} onChange={(event) => update('warranty_type', event.target.value)}><option value="">Select warranty</option><option>Manufacturer</option><option>Extended Warranty</option><option>Out of Warranty</option><option>Home Warranty</option></select></label>
          <label className="wide">Problem / Call Notes *<textarea required rows={4} value={form.issue_description} onChange={(event) => update('issue_description', event.target.value)} /></label>
          <label className="wide">Special Request<textarea rows={3} value={form.special_request} onChange={(event) => update('special_request', event.target.value)} /></label>

          <button className="call-claim-btn wide" disabled={saving} type="submit">
            <ClipboardPlus size={16} />
            {saving ? 'Creating Ticket...' : 'Create Manual Ticket'}
          </button>
        </form>
      </section>
    </div>
  );
}

type RecordingResponse = {
  recording: null | {
    signed_url: string;
    mime: string | null;
    uploaded_at: string | null;
  };
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCallDuration(seconds?: number | null) {
  if (!seconds) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

function CallDetailsModal({
  call,
  onClose,
}: {
  call: RtcCall;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingMessage, setRecordingMessage] = useState('Loading recording...');

  useEffect(() => {
    let cancelled = false;
    async function loadRecording() {
      if (!user) return;
      setRecordingMessage('Loading recording...');
      setRecordingUrl(null);
      try {
        const data = await fetchJsonWithFirebase<RecordingResponse>(user, `/api/calls/${call.id}/recording`);
        if (cancelled) return;
        if (data.recording?.signed_url) {
          setRecordingUrl(data.recording.signed_url);
          setRecordingMessage(data.recording.uploaded_at ? `Uploaded ${formatDateTime(data.recording.uploaded_at)}` : 'Recording ready');
        } else {
          setRecordingMessage('No recording uploaded yet.');
        }
      } catch (error) {
        if (!cancelled) setRecordingMessage(error instanceof Error ? error.message : 'Unable to load recording.');
      }
    }
    void loadRecording();
    return () => {
      cancelled = true;
    };
  }, [call.id, user]);

  return (
    <div className="call-manual-backdrop" role="presentation" onClick={onClose}>
      <section className="call-details-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="call-eyebrow"><Info size={14} /> Call history</span>
            <h2>{call.customer_name}</h2>
            <p>{call.request_number || 'No linked ticket'} • {call.branch || 'Unassigned branch'}</p>
          </div>
          <button aria-label="Close call details" onClick={onClose} type="button"><X size={18} /></button>
        </header>

        <div className="call-details-grid">
          <div><span>Status</span><strong>{statusLabel(call.status)}</strong></div>
          <div><span>Queued</span><strong>{formatDateTime(call.queued_at)}</strong></div>
          <div><span>Answered By</span><strong>{call.accepted_by_name || '—'}</strong></div>
          <div><span>Duration</span><strong>{formatCallDuration(call.call_duration_seconds)}</strong></div>
          <div><span>Branch</span><strong>{call.branch || '—'}</strong></div>
          <div><span>ZIP</span><strong>{call.zip_code || '—'}</strong></div>
          <div><span>Phone</span><strong>{call.phone_number || '—'}</strong></div>
          <div><span>Email</span><strong>{call.customer_email || '—'}</strong></div>
        </div>

        <section className="call-recording-card">
          <div>
            <FileAudio size={22} />
            <div>
              <strong>Recorded Audio</strong>
              <p>{recordingMessage}</p>
            </div>
          </div>
          {recordingUrl ? <audio controls src={recordingUrl} /> : null}
        </section>

        <section className="call-details-notes">
          <h3><CalendarDays size={16} /> Notes</h3>
          <p>{call.call_reason || call.notes || 'No notes saved for this call.'}</p>
          {call.ended_reason ? <small>Ended reason: {call.ended_reason}</small> : null}
        </section>
      </section>
    </div>
  );
}

export function CallsPage() {
  const { user, role } = useAuth();
  const [calls, setCalls] = useState<RtcCall[]>([]);
  const [historyCalls, setHistoryCalls] = useState<RtcCall[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [status, setStatus] = useState<'open' | RtcCallStatus | 'history'>('open');
  const [search, setSearch] = useState('');
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [activeCall, setActiveCall] = useState<RtcCall | null>(null);
  const [detailCall, setDetailCall] = useState<RtcCall | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const copy = roleHeadline(role);

  const loadCalls = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const history = status === 'history' || status === 'completed' || status === 'cancelled';
      const statusParam = status !== 'open' && status !== 'history' ? `&status=${status}` : '';
      const data = await fetchJsonWithFirebase<RtcCallListResponse>(
        user,
        `/api/calls?limit=120${history ? '&history=true' : ''}${statusParam}`,
      );
      if (data.setup_required) throw new Error(data.message || 'Web call queue setup is missing.');
      setCalls(data.calls);
      setBranches((current) => Array.from(new Set([...current, ...data.branches])).sort((a, b) => a.localeCompare(b)));
      setLastLoadedAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }));
      setActiveCall((current) => current ? data.calls.find((call) => call.id === current.id) ?? current : current);
      setDetailCall((current) => current ? data.calls.find((call) => call.id === current.id) ?? current : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load call queue.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [status, user]);

  const loadCallHistory = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setHistoryLoading(true);
    try {
      const data = await fetchJsonWithFirebase<RtcCallListResponse>(user, '/api/calls?history=true&limit=120');
      if (data.setup_required) throw new Error(data.message || 'Web call queue setup is missing.');
      setHistoryCalls(data.calls);
      setDetailCall((current) => current ? data.calls.find((call) => call.id === current.id) ?? current : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load call history.');
    } finally {
      if (!silent) setHistoryLoading(false);
    }
  }, [user]);

  const loadBranches = useCallback(async () => {
    try {
      const response = await fetch('/api/service-areas?limit=15000', { cache: 'no-store' });
      const data = (await response.json()) as ServiceAreasResponse;
      const next = new Set<string>();
      data.service_areas?.forEach((area) => {
        const branch = cleanBranch(area.location || area.region);
        if (branch) next.add(branch);
      });
      data.locations?.forEach((location) => {
        const branch = cleanBranch(location.location);
        if (branch) next.add(branch);
      });
      setBranches((current) => Array.from(new Set([...current, ...next])).sort((a, b) => a.localeCompare(b)));
    } catch {
      // Calls still work; branch options can come from loaded calls.
    }
  }, []);

  useEffect(() => {
    void loadCalls();
    void loadCallHistory();
    void loadBranches();
  }, [loadBranches, loadCallHistory, loadCalls]);

  useLiveUpdate('calls', () => { void loadCalls(true); });

  useEffect(() => {
    const timer = window.setInterval(() => void loadCalls(true), activeCall ? 15000 : 8000);
    return () => window.clearInterval(timer);
  }, [activeCall?.id, loadCalls]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadCallHistory(true), activeCall ? 30000 : 15000);
    return () => window.clearInterval(timer);
  }, [activeCall?.id, loadCallHistory]);

  const metrics = useMemo(() => {
    const waiting = calls.filter((call) => call.status === 'manager_queue').length;
    const accepted = calls.filter((call) => call.status === 'accepted').length;
    const completed = historyCalls.filter((call) => call.status === 'completed').length;
    const branchesInQueue = new Set(calls.map((call) => call.branch).filter(Boolean)).size;
    return { waiting, accepted, completed, branchesInQueue };
  }, [calls, historyCalls]);

  const historyMetrics = useMemo(() => {
    const total = historyCalls.length;
    const withRecordings = historyCalls.filter((call) => call.recording_path || call.recording_uploaded_at).length;
    const completed = historyCalls.filter((call) => call.status === 'completed').length;
    return { total, withRecordings, completed };
  }, [historyCalls]);

  const filteredCalls = useMemo(() => {
    const query = search.trim().toLowerCase();
    return calls.filter((call) => {
      if (selectedBranches.length && !selectedBranches.includes(call.branch || '')) return false;
      if (!query) return true;
      return [
        call.customer_name,
        call.customer_email,
        call.phone_number,
        call.request_number,
        call.branch,
        call.city,
        call.state,
        call.zip_code,
        call.call_reason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [calls, search, selectedBranches]);

  const handleCallEnded = useCallback(() => {
    setActiveCall(null);
    void loadCalls(true);
    void loadCallHistory(true);
  }, [loadCallHistory, loadCalls]);

  async function acceptCall(call: RtcCall) {
    if (!user) return;
    setError(null);
    try {
      const data = await fetchJsonWithFirebase<{ call: Partial<RtcCall> }>(user, `/api/calls/${call.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'accept' }),
      });
      await loadCalls(true);
      setActiveCall({ ...call, ...data.call, status: 'accepted' } as RtcCall);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept call.');
    }
  }

  function toggleBranch(branch: string) {
    setSelectedBranches((current) =>
      current.includes(branch) ? current.filter((item) => item !== branch) : [...current, branch],
    );
  }

  return (
    <div className="call-desk-shell">
      <section className="call-hero-panel">
        <div>
          <span className="call-eyebrow"><PhoneCall size={15} /> Live call operations</span>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="call-hero-actions">
          <button className="call-refresh-btn highlight" onClick={() => setManualOpen(true)} type="button">
            <ClipboardPlus size={16} />
            Manual Ticket
          </button>
          <button className="call-refresh-btn" onClick={() => void loadCalls()} type="button">
            <RefreshCw size={16} />
            Refresh
          </button>
          <span className="call-live-pill"><Activity size={14} /> {lastLoadedAt ? `Updated ${lastLoadedAt}` : 'Live polling'}</span>
        </div>
      </section>

      <section className="call-metric-grid">
        <div><span>Waiting</span><strong>{metrics.waiting}</strong><small>Customer requested</small></div>
        <div><span>In Rooms</span><strong>{metrics.accepted}</strong><small>WebRTC active</small></div>
        <div><span>Completed</span><strong>{metrics.completed}</strong><small>Recent history</small></div>
        <div><span>Branches</span><strong>{metrics.branchesInQueue}</strong><small>In current queue</small></div>
      </section>

      {error ? <div className="call-room-alert">{error}</div> : null}

      <section className="call-workspace-grid">
        <div className="call-queue-panel">
          <div className="call-toolbar">
            <div className="call-search-box">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, phone, request, ZIP, branch..." />
            </div>
            <div className="call-select-wrap">
              <SlidersHorizontal size={15} />
              <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="branch-multi-select">
              <button onClick={() => setBranchMenuOpen((value) => !value)} type="button">
                <MapPin size={15} />
                {selectedBranches.length ? `${selectedBranches.length} branches` : 'All branches'}
                <ChevronDown size={15} />
              </button>
              {branchMenuOpen ? (
                <div className="branch-multi-menu">
                  <div className="branch-multi-actions">
                    <button onClick={() => setSelectedBranches(branches)} type="button">All</button>
                    <button onClick={() => setSelectedBranches([])} type="button">Clear</button>
                  </div>
                  <div className="branch-check-list">
                    {branches.map((branch) => (
                      <label key={branch}>
                        <input checked={selectedBranches.includes(branch)} onChange={() => toggleBranch(branch)} type="checkbox" />
                        <span>{branch}</span>
                      </label>
                    ))}
                    {!branches.length ? <p>No branches loaded yet.</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="call-queue-headline">
            <h2><Headphones size={18} /> Incoming customer calls</h2>
            <span>{filteredCalls.length} shown</span>
          </div>

          <div className="call-card-list">
            {loading ? <div className="call-empty-state">Loading calls...</div> : null}
            {!loading && !filteredCalls.length ? (
              <div className="call-empty-state">
                <PhoneCall size={28} />
                <strong>No calls match the current filters.</strong>
                <p>New customer web calls will appear here automatically.</p>
              </div>
            ) : null}
            {filteredCalls.map((call) => (
              <article className={`call-request-card ${activeCall?.id === call.id ? 'active' : ''}`} key={call.id}>
                <div className="call-card-main">
                  <span className={`call-status-dot ${call.status}`} />
                  <div>
                    <strong>{call.customer_name}</strong>
                    <small>{call.request_number || 'No linked request'} • {timeAgo(call.queued_at)}</small>
                  </div>
                </div>
                <div className="call-card-meta">
                  <span><MapPin size={14} /> {call.branch || 'Unassigned'}{call.zip_code ? ` • ${call.zip_code}` : ''}</span>
                  <span><PhoneCall size={14} /> {call.phone_number}</span>
                  <span><Clock3 size={14} /> {statusLabel(call.status)}</span>
                  {call.accepted_by_name ? <span><UserCheck size={14} /> {call.accepted_by_name}</span> : null}
                </div>
                <p>{call.call_reason || 'Customer requested a web call.'}</p>
                <div className="call-card-actions">
                  {call.status === 'manager_queue' || call.status === 'assigned' ? (
                    <button className="call-claim-btn" onClick={() => void acceptCall(call)} type="button">
                      <Check size={16} />
                      Answer Call
                    </button>
                  ) : null}
                  {call.status === 'accepted' ? (
                    <button className="call-open-btn" onClick={() => setActiveCall(call)} type="button">
                      <Headphones size={16} />
                      Open Room
                    </button>
                  ) : null}
                  <button className="call-ghost-btn" onClick={() => setDetailCall(call)} type="button">
                    <Info size={16} />
                    Details
                  </button>
                  {activeCall?.id === call.id ? (
                    <button className="call-ghost-btn" onClick={() => setActiveCall(null)} type="button">
                      <X size={16} />
                      Close
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="call-room-panel">
          {activeCall ? (
            <WebRtcCallRoom call={activeCall} participantRole="staff" onCallEnded={handleCallEnded} />
          ) : (
            <div className="call-room-placeholder">
              <span><ShieldCheck size={30} /></span>
              <h3>No active room selected</h3>
              <p>Answer an incoming branch-routed call to open the secure WebRTC audio room here.</p>
            </div>
          )}
        </aside>
      </section>

      <section className="call-history-panel">
        <div className="call-history-head">
          <div>
            <span className="call-eyebrow"><Clock3 size={14} /> CSR call history</span>
            <h2>All calls made through this call desk</h2>
            <p>Click any call to view customer details, queue status, duration, and recorded audio.</p>
          </div>
          <div className="call-history-stats">
            <span>{historyMetrics.total} total</span>
            <span>{historyMetrics.completed} completed</span>
            <span>{historyMetrics.withRecordings} recordings</span>
          </div>
        </div>

        <div className="call-history-list">
          {historyLoading ? <div className="call-empty-state">Loading call history...</div> : null}
          {!historyLoading && !historyCalls.length ? (
            <div className="call-empty-state">
              <Clock3 size={28} />
              <strong>No call history yet.</strong>
              <p>Completed, cancelled, missed, and active calls will appear here.</p>
            </div>
          ) : null}
          {historyCalls.map((call) => (
            <button className="call-history-row" key={call.id} onClick={() => setDetailCall(call)} type="button">
              <span className={`call-status-dot ${call.status}`} />
              <div>
                <strong>{call.customer_name}</strong>
                <small>{formatDateTime(call.queued_at)} • {call.branch || 'Unassigned'} • {statusLabel(call.status)}</small>
              </div>
              <span>{call.accepted_by_name || 'No staff yet'}</span>
              <span>{formatCallDuration(call.call_duration_seconds)}</span>
              <span className={call.recording_path ? 'recording-ready' : ''}>
                <FileAudio size={14} />
                {call.recording_path ? 'Recording' : 'No recording'}
              </span>
            </button>
          ))}
        </div>
      </section>

      {manualOpen ? <QuickManualTicketPanel call={activeCall} onClose={() => setManualOpen(false)} /> : null}
      {detailCall ? <CallDetailsModal call={detailCall} onClose={() => setDetailCall(null)} /> : null}
    </div>
  );
}
