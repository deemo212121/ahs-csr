'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Clock3, Headphones, MapPin, PhoneCall, PhoneOff, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import type { RtcCall, RtcCallListResponse } from '@/lib/calls/types';
import { WebRtcCallRoom } from '@/components/calls/WebRtcCallRoom';

function timeLabel(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function statusCopy(call?: RtcCall | null) {
  if (!call) return 'Ready';
  if (call.status === 'manager_queue') return 'Waiting for staff';
  if (call.status === 'accepted') return 'Staff answered';
  if (call.status === 'completed') return 'Completed';
  if (call.status === 'cancelled') return 'Cancelled';
  return 'Queued';
}

export function CustomerCallsPage() {
  const { user, profile } = useAuth();
  const [calls, setCalls] = useState<RtcCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCall = useMemo(
    () => calls.find((call) => ['manager_queue', 'assigned', 'accepted'].includes(call.status)) ?? null,
    [calls],
  );

  const recentCalls = useMemo(() => calls.slice(0, 5), [calls]);

  const loadCalls = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchJsonWithFirebase<RtcCallListResponse>(user, '/api/calls?history=true&limit=20');
      if (data.setup_required) throw new Error(data.message || 'Web call queue setup is missing.');
      setCalls(data.calls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your calls.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadCalls();
  }, [loadCalls]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadCalls(true), activeCall?.status === 'accepted' ? 12000 : 6000);
    return () => window.clearInterval(timer);
  }, [activeCall?.status, loadCalls]);

  async function requestCall() {
    if (!user) return;
    setRequesting(true);
    setError(null);
    try {
      const data = await fetchJsonWithFirebase<{ call: RtcCall; reused?: boolean }>(user, '/api/calls', {
        method: 'POST',
        body: JSON.stringify({
          call_reason: 'Customer requested a live web call from the customer portal.',
        }),
      });
      setCalls((current) => [data.call, ...current.filter((call) => call.id !== data.call.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request a call.');
    } finally {
      setRequesting(false);
    }
  }

  async function cancelCall() {
    if (!user || !activeCall) return;
    setError(null);
    try {
      await fetchJsonWithFirebase(user, `/api/calls/${activeCall.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'cancel', reason: 'Customer cancelled the web call request.' }),
      });
      await loadCalls(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel call.');
    }
  }

  return (
    <div className="customer-page-shell customer-call-page">
      <section className="customer-call-hero">
        <div>
          <span><PhoneCall size={16} /> Live web call</span>
          <h1>Request a support call</h1>
          <p>
            We’ll route your request by service ZIP/branch, then a CSR, Team Leader, or Manager can answer in a browser audio room.
            WebRTC does not require your phone number.
          </p>
        </div>
        <div className="customer-call-status-card">
          <strong>{statusCopy(activeCall)}</strong>
          <small>{activeCall ? `${activeCall.branch || 'Branch pending'} • ${timeLabel(activeCall.queued_at)}` : 'No active call waiting'}</small>
        </div>
      </section>

      {error ? <div className="customer-alert">{error}</div> : null}

      <section className="customer-call-action-panel">
        <div>
          <h2><BellRing size={20} /> Start a web call request</h2>
          <p>
            Routing uses your service ZIP/branch when available: {profile?.region || 'branch pending'} • {profile?.zip_code || 'ZIP not set'}.
            Phone is only fallback contact, not required for WebRTC.
          </p>
        </div>
        <div className="customer-call-actions">
          <button className="cx-action-btn blue" disabled={requesting || Boolean(activeCall)} onClick={() => void requestCall()} type="button">
            <Headphones size={18} />
            {activeCall ? 'Call already queued' : requesting ? 'Requesting...' : 'Request Web Call'}
          </button>
          {activeCall && activeCall.status !== 'accepted' ? (
            <button className="cx-action-btn light danger" onClick={() => void cancelCall()} type="button">
              <PhoneOff size={18} />
              Cancel
            </button>
          ) : null}
          <button className="cx-action-btn light" onClick={() => void loadCalls()} type="button">
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </section>

      {activeCall ? (
        <WebRtcCallRoom call={activeCall} participantRole="customer" onCallEnded={() => void loadCalls(true)} />
      ) : (
        <section className="customer-call-waiting-card">
          <ShieldCheck size={30} />
          <h3>No active web call</h3>
          <p>Click “Request Web Call” and keep this page open. The room will unlock when staff answers.</p>
        </section>
      )}

      <section className="cx-section-block">
        <div className="cx-section-title">
          <h2>Recent call requests</h2>
          <span>{loading ? 'Loading...' : `${recentCalls.length} shown`}</span>
        </div>
        <div className="customer-call-history">
          {recentCalls.map((call) => (
            <article key={call.id}>
              <span className={`call-status-dot ${call.status}`} />
              <div>
                <strong>{statusCopy(call)}</strong>
                <small><Clock3 size={13} /> {timeLabel(call.queued_at)} • <MapPin size={13} /> {call.branch || 'Branch pending'}</small>
              </div>
            </article>
          ))}
          {!loading && !recentCalls.length ? <div className="cx-empty-row">No web call requests yet.</div> : null}
        </div>
      </section>
    </div>
  );
}
