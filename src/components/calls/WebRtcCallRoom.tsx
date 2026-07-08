'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, PhoneOff, PictureInPicture2, Radio, ShieldCheck, Volume2, Wifi, WifiOff, X } from 'lucide-react';
import fixWebmDuration from 'fix-webm-duration';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import type { RtcCall, RtcSignal, RtcSignalType, IceServersResponse } from '@/lib/calls/types';

type WebRtcCallRoomProps = {
  call: RtcCall;
  participantRole: 'customer' | 'staff';
  onCallEnded?: () => void;
  // 'full' is the normal in-page room UI. 'floating' renders a compact bar
  // (duration, mute, end call) for when the user has navigated away from the
  // calls page — the same underlying RTCPeerConnection keeps running either
  // way, only the chrome around it changes.
  variant?: 'full' | 'floating';
};

type SignalResponse = { signals: RtcSignal[] };

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function recordingLabel(status: 'off' | 'recording' | 'saving' | 'saved' | 'failed') {
  if (status === 'recording') return 'Recording';
  if (status === 'saving') return 'Saving recording';
  if (status === 'saved') return 'Recording saved';
  if (status === 'failed') return 'Recording failed';
  return 'Recording starts once connected';
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

export function WebRtcCallRoom({ call, participantRole, onCallEnded, variant = 'full' }: WebRtcCallRoomProps) {
  const { user } = useAuth();
  const onCallEndedRef = useRef(onCallEnded);
  useEffect(() => {
    onCallEndedRef.current = onCallEnded;
  }, [onCallEnded]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const lastSignalAtRef = useRef<string>(new Date(Date.now() - 3000).toISOString());
  const offerSentRef = useRef(false);
  const readySentRef = useRef(false);
  const startSentRef = useRef(false);
  const restartInFlightRef = useRef(false);
  const lastRestartAtRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingContextRef = useRef<AudioContext | null>(null);
  const recordingNodesRef = useRef<MediaStreamAudioSourceNode[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  // If the call was already accepted before this component mounted (e.g. this
  // side just refreshed mid-call), say "Reconnecting" instead of "Preparing" —
  // this is a resume, not a fresh join, and the other side's grace window is
  // already forgiving it for a few seconds.
  const [status, setStatus] = useState(call.accepted_at ? 'Reconnecting to the call...' : 'Preparing secure audio room...');
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [muted, setMuted] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [turnConfigured, setTurnConfigured] = useState<boolean | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<'off' | 'recording' | 'saving' | 'saved' | 'failed'>('off');
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

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      if (!user || participantRole !== 'staff' || !blob.size) return;

      setRecordingStatus('saving');
      try {
        const token = await user.getIdToken();
        const formData = new FormData();
        const extension = blob.type.includes('ogg') ? 'ogg' : 'webm';
        formData.append('recording', blob, `call-${call.id}.${extension}`);

        const response = await fetch(`/api/calls/${call.id}/recording`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Recording upload failed.');
        setRecordingStatus('saved');
      } catch (error) {
        setRecordingStatus('failed');
        setRoomError(error instanceof Error ? error.message : 'Unable to save call recording.');
      }
    },
    [call.id, participantRole, user],
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      setRecordingStatus('saving');
      recorder.stop();
    }

    recordingNodesRef.current.forEach((node) => {
      try {
        node.disconnect();
      } catch {
        // no-op
      }
    });
    recordingNodesRef.current = [];
    void recordingContextRef.current?.close().catch(() => undefined);
    recordingContextRef.current = null;
  }, []);

  const tryStartRecording = useCallback(() => {
    if (participantRole !== 'staff') return;
    if (pcRef.current?.connectionState !== 'connected') return;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') return;

    const localStream = localStreamRef.current;
    const remoteStream = remoteStreamRef.current;
    if (!localStream || !remoteStream) return;

    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      const localSource = audioContext.createMediaStreamSource(localStream);
      const remoteSource = audioContext.createMediaStreamSource(remoteStream);
      localSource.connect(destination);
      remoteSource.connect(destination);

      recordingContextRef.current = audioContext;
      recordingNodesRef.current = [localSource, remoteSource];
      recordingChunksRef.current = [];

      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const recorder = new MediaRecorder(destination.stream, preferredMime ? { mimeType: preferredMime } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || preferredMime || 'audio/webm' });
        recordingChunksRef.current = [];

        // MediaRecorder writes webm without a Duration in the header — the
        // browser has no way to know the total length upfront, so playback
        // controls can't calculate seek positions and the scrub handle
        // silently fails to drag. Patch it in from the wall-clock time we
        // actually recorded for before uploading.
        const startedAt = recordingStartedAtRef.current;
        const duration = startedAt ? Date.now() - startedAt : 0;
        if (blob.type.includes('webm') && duration > 0) {
          fixWebmDuration(blob, duration)
            .then((fixed) => uploadRecording(fixed))
            .catch(() => uploadRecording(blob));
        } else {
          void uploadRecording(blob);
        }
      };
      recordingStartedAtRef.current = Date.now();
      recorder.start(1000);
      console.debug(`[webrtc:${participantRole}] recording started (connectionState was connected) at ${new Date().toISOString()}`);
      setRecordingStatus('recording');
    } catch (error) {
      setRecordingStatus('failed');
      setRoomError(error instanceof Error ? error.message : 'Unable to start call recording.');
    }
  }, [participantRole, uploadRecording]);

  const cleanup = useCallback(() => {
    stopRecording();
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
    remoteStreamRef.current = null;
    pendingCandidatesRef.current = [];
  }, [participantRole, stopRecording]);

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
    let recoveryTimer: number | null = null;
    let unstableSince: number | null = null;
    const DISCONNECT_GRACE_MS = 10000;
    const RESTART_RETRY_MS = 8000;
    const UNRECOVERABLE_AFTER_MS = 45000;
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

    function clearRecoveryTimer() {
      if (recoveryTimer) {
        window.clearTimeout(recoveryTimer);
        recoveryTimer = null;
      }
    }

    async function logSelectedCandidatePair(peer: RTCPeerConnection) {
      try {
        const stats = await peer.getStats();
        let activePair: any = null;
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded') {
            activePair = report;
          }
        });
        if (!activePair) {
          log('getStats(): no nominated/succeeded candidate pair found yet');
          return;
        }
        const local = stats.get(activePair.localCandidateId) as any;
        const remote = stats.get(activePair.remoteCandidateId) as any;
        log(
          `selected candidate pair — local: ${local?.candidateType ?? 'unknown'} (${local?.protocol ?? '?'}), ` +
            `remote: ${remote?.candidateType ?? 'unknown'} (${remote?.protocol ?? '?'})` +
            `${local?.candidateType === 'relay' || remote?.candidateType === 'relay' ? ' — TURN relay in use' : ' — direct/STUN path, no relay needed'}`,
        );
      } catch (error) {
        log(`getStats() failed: ${error instanceof Error ? error.message : String(error)}`);
      }
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
          remoteStreamRef.current = stream;
          remoteAudioRef.current.srcObject = stream;
          void remoteAudioRef.current.play().catch(() => undefined);
          tryStartRecording();
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
          unstableSince = null;
          clearRecoveryTimer();
          setStatus('Connected — live audio is running.');
          tryStartRecording();
          void logSelectedCandidatePair(peer);
          if (!startSentRef.current) {
            startSentRef.current = true;
            void patchCall('start');
          }
        }
        if (peer.connectionState === 'disconnected') {
          // Often transient (a few seconds of dropped STUN keepalives). Browsers
          // routinely recover from this on their own. Give it a grace window before
          // we proactively restart, instead of acting immediately or waiting forever.
          if (unstableSince === null) unstableSince = Date.now();
          setStatus('Connection is unstable. Waiting to see if it recovers...');
          scheduleRecoveryCheck(DISCONNECT_GRACE_MS);
        }
        if (peer.connectionState === 'failed') {
          if (unstableSince === null) unstableSince = Date.now();
          setStatus('Connection dropped. Reconnecting...');
          void restartConnection();
          scheduleRecoveryCheck(RESTART_RETRY_MS);
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
      if (Date.now() - lastRestartAtRef.current < RESTART_RETRY_MS) return;
      if (peer.signalingState !== 'stable') {
        // The peer is mid-negotiation (e.g. a stale replayed offer/answer is
        // still being processed) — it should settle to "stable" shortly.
        // Retrying instead of giving up here was the gap that made some
        // reconnects silently never happen: this restart attempt would just
        // be dropped with nothing else scheduled to try again until the next
        // connectionstatechange event, which may not fire again on its own.
        log(`restartIce deferred — signalingState is "${peer.signalingState}", retrying shortly`);
        window.setTimeout(() => {
          if (!cancelled) void restartConnection();
        }, 2000);
        return;
      }

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

    async function giveUp(reason: string) {
      log(`Unrecoverable — ${reason}`);
      clearRecoveryTimer();
      setStatus('Connection lost. Ending call...');
      try {
        await postSignal('hangup', { reason });
        await patchCall('end', reason);
      } catch {
        // Best effort — we're tearing down the room regardless.
      } finally {
        cleanup();
        setConnectionState('closed');
        setStatus('Call ended — connection could not be recovered.');
        onCallEndedRef.current?.();
      }
    }

    function scheduleRecoveryCheck(delayMs: number) {
      clearRecoveryTimer();
      recoveryTimer = window.setTimeout(() => {
        recoveryTimer = null;
        if (cancelled) return;
        const peer = pcRef.current;
        if (!peer || peer.connectionState === 'closed') return;

        if (peer.connectionState === 'connected') {
          unstableSince = null;
          return;
        }

        if (unstableSince && Date.now() - unstableSince > UNRECOVERABLE_AFTER_MS) {
          void giveUp(`stuck in "${peer.connectionState}" for over ${Math.round(UNRECOVERABLE_AFTER_MS / 1000)}s with no recovery.`);
          return;
        }

        if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
          void restartConnection();
          scheduleRecoveryCheck(RESTART_RETRY_MS);
        }
      }, delayMs);
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
        // A "ready" signal normally only arrives once, right when staff joins.
        // But if staff refreshes mid-call, their fresh room re-sends "ready" —
        // and since this customer side already sent its initial offer,
        // sendOffer() would silently no-op (offerSentRef is already true),
        // leaving the call stuck instead of recovering. Treat a repeat
        // "ready" as a reconnect cue and nudge a fresh ICE-restart offer.
        if (offerSentRef.current) {
          await restartConnection();
        } else {
          await sendOffer();
        }
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

    // Background tabs get their setInterval timers throttled by the browser
    // (often to once a minute or less) — that's what made switching tabs look
    // like a disconnect: signal polling and heartbeats basically stopped,
    // even though the underlying audio/peer connection was usually still
    // alive. Catch up immediately the moment the tab is foregrounded again,
    // instead of waiting for the next throttled tick.
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible' || cancelled) return;
      log('tab became visible again — resyncing signals/heartbeat immediately');
      void pollSignals();
      void patchCall('heartbeat');
      const peer = pcRef.current;
      if (peer && (peer.connectionState === 'disconnected' || peer.connectionState === 'failed')) {
        void restartConnection();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (signalTimer) window.clearInterval(signalTimer);
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      clearRecoveryTimer();
      cleanup();
    };
  }, [call.accepted_at, call.id, call.queued_at, canJoin, cleanup, participantRole, patchCall, postSignal, signalSessionId, tryStartRecording, user]);

  useEffect(() => {
    if (connectionState !== 'connected') return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [connectionState]);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  }, []);

  // --- Floating window (OS-level Picture-in-Picture), only while on a call ---
  // Two tiers, since standard <video> PiP has no way to host real buttons:
  //  - Document PiP (Chrome/Brave/Edge only): a real floating window with
  //    working Mute/End Call buttons, opened only via the "Pop out" button
  //    below (browsers require an explicit click for this one).
  //  - Canvas-fed <video> PiP with the `autopictureinpicture` attribute: the
  //    browser opens/closes this one on its own the moment the tab is
  //    backgrounded/foregrounded — no click needed — but it can only show
  //    duration/mute status as painted pixels, not clickable controls.
  const elapsedRef = useRef(0);
  const mutedRef = useRef(muted);
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const [pipMode, setPipMode] = useState<'none' | 'document' | 'video'>('none');
  const pipWindowRef = useRef<Window | null>(null);
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const autoPipVideoRef = useRef<HTMLVideoElement | null>(null);
  const autoPipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoPipDrawTimerRef = useRef<number | null>(null);

  const closeFloatingWindow = useCallback(() => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
    }
    setPipContainer(null);
    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => undefined);
    }
    setPipMode('none');
  }, []);

  const openDocumentPip = useCallback(async () => {
    const dpip = (window as unknown as { documentPictureInPicture?: { requestWindow: (opts: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
    if (!dpip) throw new Error('Not supported');

    const pipWindow = await dpip.requestWindow({ width: 320, height: 96 });
    pipWindowRef.current = pipWindow;

    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      pipWindow.document.head.appendChild(node.cloneNode(true));
    });
    pipWindow.document.body.style.margin = '0';

    const container = pipWindow.document.createElement('div');
    pipWindow.document.body.appendChild(container);
    setPipContainer(container);
    setPipMode('document');

    pipWindow.addEventListener(
      'pagehide',
      () => {
        pipWindowRef.current = null;
        setPipContainer(null);
        setPipMode('none');
      },
      { once: true },
    );
  }, []);

  const openManualFloatingWindow = useCallback(async () => {
    if (pipMode !== 'none') return;
    try {
      if ('documentPictureInPicture' in window) {
        await openDocumentPip();
        return;
      }

      // No Document PiP here (Safari, and every mobile browser today) — fall
      // back to manually entering the same read-only canvas-fed video PiP
      // the auto-background effect sets up, except triggered by this click
      // (a real user gesture) instead of waiting for the tab to background.
      // That's the "pop out" button mobile needs, since Android/iOS won't
      // auto-enter PiP just from switching apps the way desktop Chrome will.
      const video = autoPipVideoRef.current;
      if (video && 'requestPictureInPicture' in video) {
        await video.requestPictureInPicture();
        setPipMode('video');
        video.addEventListener(
          'leavepictureinpicture',
          () => setPipMode((current) => (current === 'video' ? 'none' : current)),
          { once: true },
        );
      } else {
        setRoomError('Pop-out isn’t supported in this browser.');
      }
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : 'Unable to open the floating call window.');
    }
  }, [openDocumentPip, pipMode]);

  // Auto (no-click) read-only floating window, tied strictly to the tab
  // being backgrounded while a call is actively connected.
  useEffect(() => {
    if (connectionState !== 'connected') return;
    if (typeof HTMLVideoElement === 'undefined' || !('requestPictureInPicture' in HTMLVideoElement.prototype)) return;

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 96;
    autoPipCanvasRef.current = canvas;
    const ctx = canvas.getContext('2d');

    function draw() {
      if (!ctx) return;
      ctx.fillStyle = '#080240';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(formatDuration(elapsedRef.current), 18, 44);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = mutedRef.current ? '#f97373' : '#7dd3fc';
      ctx.fillText(mutedRef.current ? 'Muted' : 'Live call', 18, 68);
    }
    draw();

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    (video as HTMLVideoElement & { autoPictureInPicture?: boolean }).autoPictureInPicture = true;
    video.style.position = 'fixed';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    document.body.appendChild(video);
    autoPipVideoRef.current = video;

    const stream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(2);
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    autoPipDrawTimerRef.current = window.setInterval(draw, 500);

    return () => {
      if (autoPipDrawTimerRef.current) {
        window.clearInterval(autoPipDrawTimerRef.current);
        autoPipDrawTimerRef.current = null;
      }
      if (document.pictureInPictureElement === video) {
        void document.exitPictureInPicture().catch(() => undefined);
      }
      video.remove();
      autoPipVideoRef.current = null;
      autoPipCanvasRef.current = null;
    };
  }, [connectionState]);

  // Close any open interactive floating window once the call itself ends.
  useEffect(() => {
    if (connectionState === 'closed') closeFloatingWindow();
  }, [closeFloatingWindow, connectionState]);
  useEffect(() => () => closeFloatingWindow(), [closeFloatingWindow]);

  // Chrome (desktop and Android) draws real, clickable Mute/End Call buttons
  // directly into a standard <video> PiP window when the page registers
  // these two Media Session actions — the one way to get working controls
  // into "plain" video PiP without Document PiP. Each handler name throws if
  // the browser doesn't recognize it (older/other browsers), so each is set
  // independently rather than failing the whole block.
  useEffect(() => {
    if (connectionState !== 'connected' || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    // Cast needed — these two call-specific actions aren't in TS's built-in
    // MediaSessionAction union yet, though Chrome supports them at runtime.
    const session = navigator.mediaSession as MediaSession & {
      setActionHandler: (action: string, handler: (() => void) | null) => void;
    };
    try {
      session.setActionHandler('hangup', () => void endCall());
    } catch {
      // Not supported in this browser — no-op.
    }
    try {
      session.setActionHandler('togglemicrophone', () => toggleMute());
    } catch {
      // Not supported in this browser — no-op.
    }
    return () => {
      try {
        session.setActionHandler('hangup', null);
      } catch {
        // no-op
      }
      try {
        session.setActionHandler('togglemicrophone', null);
      } catch {
        // no-op
      }
    };
  }, [connectionState, endCall, toggleMute]);

  // Keeps the mic icon's on/off state in the PiP window in sync with our
  // own mute state, instead of only reacting to clicks made through it.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      (navigator.mediaSession as MediaSession & { setMicrophoneActive?: (active: boolean) => void }).setMicrophoneActive?.(!muted);
    } catch {
      // Not supported in this browser — no-op.
    }
  }, [muted]);

  const canPopOut =
    pipMode === 'none' &&
    typeof window !== 'undefined' &&
    ('documentPictureInPicture' in window ||
      (connectionState === 'connected' &&
        typeof HTMLVideoElement !== 'undefined' &&
        'requestPictureInPicture' in HTMLVideoElement.prototype));

  // The <audio> element must stay mounted across variant switches (and even
  // in the "waiting" state) — it's what remoteAudioRef points at, and losing
  // it would silently kill playback the moment the UI changes around it.
  const remoteAudioEl = <audio ref={remoteAudioRef} autoPlay playsInline />;

  if (!canJoin) {
    if (variant === 'floating') return remoteAudioEl;
    return (
      <div className="webrtc-room-card waiting">
        {remoteAudioEl}
        <div className="webrtc-orb"><Radio size={24} /></div>
        <div>
          <h3>Waiting for an available staff member</h3>
          <p>{roomSubtitle}</p>
        </div>
      </div>
    );
  }

  if (variant === 'floating') {
    return (
      <div className="webrtc-floating-bar">
        {remoteAudioEl}
        <div className={`webrtc-floating-dot ${connectionState}`} />
        <div className="webrtc-floating-copy">
          <strong>{participantRole === 'customer' ? 'Support call' : call.customer_name || 'Live call'}</strong>
          <small>{formatDuration(elapsed)} • {connectionState === 'connected' ? 'Connected' : status}</small>
        </div>
        <button className={`webrtc-floating-btn ${muted ? 'muted' : ''}`} onClick={toggleMute} type="button" aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? <MicOff size={15} /> : <Mic size={15} />}
        </button>
        <button className="webrtc-floating-btn danger" onClick={() => void endCall()} type="button" aria-label="End call">
          <PhoneOff size={15} />
        </button>
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
            {participantRole === 'staff' ? ` • ${recordingLabel(recordingStatus)}` : ''}
          </small>
        </div>
      </div>

      {roomError ? <div className="call-room-alert">{roomError}</div> : null}

      {remoteAudioEl}

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
        {canPopOut ? (
          <button className="webrtc-control" onClick={() => void openManualFloatingWindow()} type="button">
            <PictureInPicture2 size={18} />
            Pop Out
          </button>
        ) : null}
        {pipMode !== 'none' ? (
          <button className="webrtc-control" onClick={closeFloatingWindow} type="button">
            <X size={18} />
            Close Pop-out
          </button>
        ) : null}
      </div>

      {pipContainer
        ? createPortal(
            <div className="webrtc-floating-bar webrtc-floating-bar--pip">
              <div className={`webrtc-floating-dot ${connectionState}`} />
              <div className="webrtc-floating-copy">
                <strong>{participantRole === 'customer' ? 'Support call' : call.customer_name || 'Live call'}</strong>
                <small>{formatDuration(elapsed)} • {connectionState === 'connected' ? 'Connected' : status}</small>
              </div>
              <button className={`webrtc-floating-btn ${muted ? 'muted' : ''}`} onClick={toggleMute} type="button" aria-label={muted ? 'Unmute' : 'Mute'}>
                {muted ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
              <button className="webrtc-floating-btn danger" onClick={() => void endCall()} type="button" aria-label="End call">
                <PhoneOff size={15} />
              </button>
            </div>,
            pipContainer,
          )
        : null}
    </section>
  );
}
