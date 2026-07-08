'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Headphones, PhoneCall, PhoneOff, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import type { RtcCall, RtcCallListResponse } from '@/lib/calls/types';
import { useCallSession } from '@/components/calls/CallSessionProvider';

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
  const { startSession, registerAnchor } = useCallSession();
  const [calls, setCalls] = useState<RtcCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCall = useMemo(
    () => calls.find((call) => ['manager_queue', 'assigned', 'accepted'].includes(call.status)) ?? null,
    [calls],
  );

  // Two poll cadences run at once (6s while waiting, 12s once accepted — see
  // below), and the interval that starts just before a CSR accepts can still
  // resolve *after* a faster/later tick that already reflects the accepted
  // status. Without sequencing, that stale response wins and briefly flips
  // the call back to "not accepted" — which tears down and rebuilds the
  // WebRTC connection in WebRtcCallRoom, looking like a drop-and-rejoin.
  const requestSeqRef = useRef(0);

  const loadCalls = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    setError(null);
    const seq = ++requestSeqRef.current;
    try {
      const data = await fetchJsonWithFirebase<RtcCallListResponse>(user, '/api/calls?history=true&limit=20');
      if (seq !== requestSeqRef.current) return;
      if (data.setup_required) throw new Error(data.message || 'Web call queue setup is missing.');
      setCalls(data.calls);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setError(err instanceof Error ? err.message : 'Unable to load your calls.');
    } finally {
      if (seq === requestSeqRef.current && !silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadCalls();
  }, [loadCalls]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadCalls(true), activeCall?.status === 'accepted' ? 12000 : 6000);
    return () => window.clearInterval(timer);
  }, [activeCall?.status, loadCalls]);

  const handleCallEnded = useCallback(() => {
    void loadCalls(true);
  }, [loadCalls]);

  // Registering the call with the global session keeps the RTCPeerConnection
  // alive even if the customer navigates to another tab in the bottom nav —
  // it portals into the anchor below while this page is visible, and falls
  // back to a floating bar elsewhere instead of hanging up.
  useEffect(() => {
    if (!activeCall) return;
    startSession(activeCall, 'customer', handleCallEnded);
  }, [activeCall, handleCallEnded, startSession]);

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
        <button
          aria-label="Refresh"
          className="customer-icon-btn customer-call-refresh-btn"
          onClick={() => void loadCalls()}
          type="button"
        >
          <RefreshCw size={16} />
        </button>
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

      <div className="customer-call-row">
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
          </div>
        </section>

        {activeCall ? (
          <div className="webrtc-anchor" ref={registerAnchor} />
        ) : (
          <section className="customer-call-waiting-card">
            <ShieldCheck size={30} />
            <h3>No active web call</h3>
            <p>Click “Request Web Call” and keep this page open. The room will unlock when staff answers.</p>
          </section>
        )}
      </div>
    </div>
  );
}
