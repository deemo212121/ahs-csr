'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Radio, ShieldCheck, Volume2, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import type { RtcCall, RtcSignal, RtcSignalType, IceServersResponse } from '@/lib/calls/types';

type WebRtcCallRoomProps = {
  call: RtcCall;
  participantRole: 'customer' | 'staff';
  onCallEnded?: () => void;
};

type SignalResponse = { signals: RtcSignal[] };

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function isDescription(value: unknown): value is RTCSessionDescriptionInit {
  return Boolean(value && typeof value === 'object' && 'type' in value && 'sdp' in value);
}

function isIceCandidate(value: unknown): value is RTCIceCandidateInit {
  return Boolean(value && typeof value === 'object' && 'candidate' in value);
}

function signalBaseline(call: RtcCall) {
  const source = call.accepted_at || call.queued_at || new Date().toISOString();
  const time = new Date(source).getTime();
  if (!Number.isFinite(time)) return new Date(Date.now() - 10000).toISOString();
  return new Date(time - 30000).toISOString();
}

export function WebRtcCallRoom({ call, participantRole, onCallEnded }: WebRtcCallRoomProps) {
  const { user } = useAuth();
  const onCallEndedRef = useRef(onCallEnded);
  useEffect(() => {
    onCallEndedRef.current = onCallEnded;
  }, [onCallEnded]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const lastSignalAtRef = useRef<string>(new Date(Date.now() - 3000).toISOString());
  const offerSentRef = useRef(false);
  const readySentRef = useRef(false);
  const startSentRef = useRef(false);
  const restartInFlightRef = useRef(false);
  const lastRestartAtRef = useRef(0);
  const [status, setStatus] = useState('Preparing secure audio room...');
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [muted, setMuted] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [turnConfigured, setTurnConfigured] = useState<boolean | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const canJoin = call.status === 'accepted' || call.status === 'assigned';
  const roleLabel = participantRole === 'customer' ? 'Customer' : 'Staff';
  const signalSessionId = useMemo(
    () => `${call.id}:${call.accepted_at || call.queued_at}`,
    [call.accepted_at, call.id, call.queued_at],
  );

  const roomSubtitle = useMemo(() => {
    const branch = call.branch ? `${call.branch} branch` : 'unassigned branch';
    const request = call.request_number ? `Request ${call.request_number}` : 'Live support call';
    return `${request} • ${branch}`;
  }, [call.branch, call.request_number]);

  const postSignal = useCallback(
    async (type: RtcSignalType, payload: Record<string, unknown> = {}) => {
      if (!user) return;
      await fetchJsonWithFirebase(user, `/api/calls/${call.id}/signals`, {
        method: 'POST',
        body: JSON.stringify({ type, payload: { ...payload, sessionId: signalSessionId } }),
      });
    },
    [call.id, signalSessionId, user],
  );

  const patchCall = useCallback(
    async (action: 'start' | 'end' | 'heartbeat', reason?: string) => {
      if (!user) return;
      await fetchJsonWithFirebase(user, `/api/calls/${call.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, reason }),
      });
    },
    [call.id, user],
  );

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      console.debug(`[webrtc:${participantRole}] close() — tearing down RTCPeerConnection at ${new Date().toISOString()}`);
    }
    pcRef.current?.getSenders().forEach((sender) => {
      try {
        sender.track?.stop();
      } catch {
        // no-op
      }
    });
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
  }, [participantRole]);

  const endCall = useCallback(
    async (reason = 'Call ended by participant.') => {
      setStatus('Ending call...');
      try {
        await postSignal('hangup', { reason });
        await patchCall('end', reason);
      } catch (error) {
        setRoomError(error instanceof Error ? error.message : 'Unable to end the call cleanly.');
      } finally {
        cleanup();
        setConnectionState('closed');
        setStatus('Call ended.');
        onCallEndedRef.current?.();
      }
    },
    [cleanup, patchCall, postSignal],
  );

  useEffect(() => {
    if (!canJoin || !user) return;

    const activeUser = user;
    let cancelled = false;
    let signalTimer: number | null = null;
    let heartbeatTimer: number | null = null;
    lastSignalAtRef.current = signalBaseline(call);
    processedSignalsRef.current = new Set();
    pendingCandidatesRef.current = [];
    offerSentRef.current = false;
    readySentRef.current = false;
    startSentRef.current = false;
    restartInFlightRef.current = false;
    lastRestartAtRef.current = 0;

    function log(message: string) {
      console.debug(`[webrtc:${participantRole}] ${message} at ${new Date().toISOString()}`);
    }

    async function flushPendingCandidates() {
      const peer = pcRef.current;
      if (!peer?.remoteDescription) return;
      const pending = pendingCandidatesRef.current.splice(0);
      for (const candidate of pending) {
        try {
          await peer.addIceCandidate(candidate);
        } catch {
          // Candidate can become stale after ICE restart; ignore and keep the room alive.
        }
      }
    }

    async function ensurePeer() {
      if (pcRef.current) return pcRef.current;

      setStatus('Opening microphone...');
      const ice = await fetchJsonWithFirebase<IceServersResponse>(activeUser, '/api/calls/ice');
      if (cancelled) throw new Error('cancelled');
      setTurnConfigured(ice.configured);

      log('Creating RTCPeerConnection');
      const peer = new RTCPeerConnection({ iceServers: ice.iceServers });
      pcRef.current = peer;

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        void postSignal('ice-candidate', { candidate: event.candidate.toJSON() });
      };

      peer.ontrack = (event) => {
        const [stream] = event.streams;
        if (remoteAudioRef.current && stream) {
          remoteAudioRef.current.srcObject = stream;
          void remoteAudioRef.current.play().catch(() => undefined);
        }
      };

      peer.onsignalingstatechange = () => {
        log(`signalingState -> ${peer.signalingState}`);
      };

      peer.oniceconnectionstatechange = () => {
        log(`iceConnectionState -> ${peer.iceConnectionState}`);
      };

      peer.onconnectionstatechange = () => {
        log(`connectionState -> ${peer.connectionState}`);
        setConnectionState(peer.connectionState);
        if (peer.connectionState === 'connected') {
          setStatus('Connected — live audio is running.');
          if (!startSentRef.current) {
            startSentRef.current = true;
            void patchCall('start');
          }
        }
        if (peer.connectionState === 'disconnected') {
          // Often transient (a few seconds of dropped STUN keepalives). Browsers
          // routinely recover from this on their own; do not force a renegotiation
          // here, since that itself can re-trigger this same state and loop forever.
          setStatus('Connection is unstable. Waiting to see if it recovers...');
        }
        if (peer.connectionState === 'failed') {
          setStatus('Connection dropped. Reconnecting...');
          void restartConnection();
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (cancelled || peer.signalingState === 'closed') {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('cancelled');
      }
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        if (!cancelled && peer.signalingState !== 'closed') {
          peer.addTrack(track, stream);
        }
      });
      setStatus(participantRole === 'staff' ? 'Waiting for customer audio...' : 'Waiting for staff to answer...');

      if (participantRole === 'staff' && !readySentRef.current) {
        readySentRef.current = true;
        await postSignal('ready', {});
      }

      return peer;
    }

    async function sendOffer() {
      if (participantRole !== 'customer' || offerSentRef.current) return;
      const peer = await ensurePeer();
      if (cancelled || peer.signalingState !== 'stable') return;
      setStatus('Calling support...');
      log('createOffer() (initial)');
      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      log('setLocalDescription() (initial offer)');
      await peer.setLocalDescription(offer);
      offerSentRef.current = true;
      await postSignal('offer', { description: peer.localDescription?.toJSON() ?? offer });
    }

    async function restartConnection() {
      const peer = pcRef.current;
      if (!peer || cancelled || peer.signalingState === 'closed') return;
      if (participantRole !== 'customer') {
        setStatus('Connection dropped. Waiting for reconnection...');
        return;
      }
      if (restartInFlightRef.current) return;
      if (Date.now() - lastRestartAtRef.current < 8000) return;
      if (peer.signalingState !== 'stable') return;

      log('restartIce triggered (connectionState was failed)');
      restartInFlightRef.current = true;
      lastRestartAtRef.current = Date.now();
      try {
        log('createOffer() (iceRestart: true)');
        const offer = await peer.createOffer({
          iceRestart: true,
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        if (cancelled || peer.signalingState !== 'stable') return;
        log('setLocalDescription() (ICE-restart offer)');
        await peer.setLocalDescription(offer);
        await postSignal('offer', { description: peer.localDescription?.toJSON() ?? offer });
      } catch {
        // Will retry on the next failed transition, subject to the cooldown above.
      } finally {
        restartInFlightRef.current = false;
      }
    }

    async function handleSignal(signal: RtcSignal) {
      if (processedSignalsRef.current.has(signal.id)) return;
      processedSignalsRef.current.add(signal.id);
      if (signal.created_at > lastSignalAtRef.current) {
        lastSignalAtRef.current = signal.created_at;
      }
      if (signal.payload.sessionId !== signalSessionId) return;
      if (signal.sender_role === participantRole) return;
      if (cancelled) return;

      const peer = await ensurePeer();
      if (peer.signalingState === 'closed') return;

      if (signal.signal_type === 'ready' && participantRole === 'customer') {
        await sendOffer();
      }

      if (signal.signal_type === 'offer') {
        if (participantRole !== 'staff') return;
        if (peer.signalingState !== 'stable') return;
        const description = signal.payload.description;
        if (!isDescription(description)) return;
        setStatus('Customer is calling — connecting audio...');
        log(`setRemoteDescription() (incoming offer, signal ${signal.id})`);
        await peer.setRemoteDescription(description);
        await flushPendingCandidates();
        log('createAnswer()');
        const answer = await peer.createAnswer();
        log('setLocalDescription() (answer)');
        await peer.setLocalDescription(answer);
        await postSignal('answer', { description: peer.localDescription?.toJSON() ?? answer });
      }

      if (signal.signal_type === 'answer') {
        if (participantRole !== 'customer') return;
        if (peer.signalingState !== 'have-local-offer') return;
        const description = signal.payload.description;
        if (!isDescription(description)) return;
        log(`setRemoteDescription() (incoming answer, signal ${signal.id})`);
        await peer.setRemoteDescription(description);
        await flushPendingCandidates();
        setStatus('Audio handshake complete. Connecting...');
      }

      if (signal.signal_type === 'ice-candidate') {
        const candidate = signal.payload.candidate;
        if (!isIceCandidate(candidate)) return;
        if (peer.remoteDescription) {
          await peer.addIceCandidate(candidate).catch(() => undefined);
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      }

      if (signal.signal_type === 'hangup') {
        cleanup();
        setConnectionState('closed');
        setStatus('The other participant ended the call.');
        onCallEndedRef.current?.();
      }
    }

    async function pollSignals() {
      try {
        if (cancelled || pcRef.current?.signalingState === 'closed') return;
        const after = encodeURIComponent(lastSignalAtRef.current);
        const data = await fetchJsonWithFirebase<SignalResponse>(activeUser, `/api/calls/${call.id}/signals?after=${after}`);
        for (const signal of data.signals) {
          if (cancelled) return;
          await handleSignal(signal);
        }
      } catch (error) {
        if (cancelled || (error instanceof Error && error.message === 'cancelled')) return;
        setRoomError(error instanceof Error ? error.message : 'Unable to exchange WebRTC signals.');
      }
    }

    async function start() {
      try {
        await ensurePeer();
        await patchCall('heartbeat');
        await pollSignals();
        signalTimer = window.setInterval(() => void pollSignals(), 1500);
        heartbeatTimer = window.setInterval(() => void patchCall('heartbeat'), 20000);
      } catch (error) {
        if (cancelled || (error instanceof Error && error.message === 'cancelled')) return;
        setRoomError(error instanceof Error ? error.message : 'Unable to start the call room.');
        setStatus('Call room failed to start.');
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (signalTimer) window.clearInterval(signalTimer);
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      cleanup();
    };
  }, [call.accepted_at, call.id, call.queued_at, canJoin, cleanup, participantRole, patchCall, postSignal, signalSessionId, user]);

  useEffect(() => {
    if (connectionState !== 'connected') return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [connectionState]);

  function toggleMute() {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  }

  if (!canJoin) {
    return (
      <div className="webrtc-room-card waiting">
        <div className="webrtc-orb"><Radio size={24} /></div>
        <div>
          <h3>Waiting for an available staff member</h3>
          <p>{roomSubtitle}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="webrtc-room-card">
      <div className="webrtc-room-top">
        <div>
          <span className="call-eyebrow"><ShieldCheck size={14} /> Secure WebRTC audio</span>
          <h3>{participantRole === 'customer' ? 'Support call room' : `Live call with ${call.customer_name}`}</h3>
          <p>{roomSubtitle}</p>
        </div>
        <div className={`webrtc-state ${connectionState}`}>
          {connectionState === 'connected' ? <Wifi size={16} /> : <WifiOff size={16} />}
          {connectionState}
        </div>
      </div>

      <div className="webrtc-call-stage">
        <div className="webrtc-avatar-ring">
          <span>{participantRole === 'customer' ? 'US' : (call.customer_name || 'CX').slice(0, 2).toUpperCase()}</span>
        </div>
        <div className="webrtc-status-copy">
          <strong>{status}</strong>
          <small>
            {roleLabel} side • {turnConfigured === false ? 'STUN fallback only' : 'TURN ready'} • {formatDuration(elapsed)}
          </small>
        </div>
      </div>

      {roomError ? <div className="call-room-alert">{roomError}</div> : null}

      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="webrtc-controls">
        <button className={`webrtc-control ${muted ? 'muted' : ''}`} onClick={toggleMute} type="button">
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <button className="webrtc-control listen" type="button" onClick={() => remoteAudioRef.current?.play().catch(() => undefined)}>
          <Volume2 size={18} />
          Speaker
        </button>
        <button className="webrtc-control danger" onClick={() => void endCall()} type="button">
          <PhoneOff size={18} />
          End Call
        </button>
      </div>
    </section>
  );
}
