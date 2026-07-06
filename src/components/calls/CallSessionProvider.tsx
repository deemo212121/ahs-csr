'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WebRtcCallRoom } from '@/components/calls/WebRtcCallRoom';
import type { RtcCall } from '@/lib/calls/types';

type ParticipantRole = 'customer' | 'staff';

type Session = {
  call: RtcCall;
  participantRole: ParticipantRole;
  onEnded?: () => void;
};

type CallSessionContextValue = {
  hasSession: boolean;
  // Starts (or, if the same call is already active, just refreshes the call
  // payload without re-creating the underlying RTCPeerConnection) a call
  // session that survives page navigation.
  startSession: (call: RtcCall, participantRole: ParticipantRole, onEnded?: () => void) => void;
  // Point this at a DOM node (via ref callback) rendered inline on a page —
  // while it's mounted, the room visually overlays that spot. Once it
  // unmounts (navigated away), the room keeps running and floats top-left
  // instead. Either way the WebRtcCallRoom instance itself never moves in
  // the DOM tree, so it never remounts/reconnects on navigation.
  registerAnchor: (el: HTMLElement | null) => void;
};

const CallSessionContext = createContext<CallSessionContextValue | null>(null);

export function CallSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  // A single portal target created once and never swapped — WebRtcCallRoom
  // always portals into this same node, so switching between "docked at an
  // anchor" and "floating" only ever repositions this div with CSS. Portaling
  // into a *different* target (e.g. conditionally rendering with vs. without
  // createPortal) makes React treat it as a brand new element and remounts
  // it — which was silently reconnecting the call on every navigation.
  useEffect(() => {
    const div = document.createElement('div');
    div.setAttribute('data-call-room-root', '');
    document.body.appendChild(div);
    containerRef.current = div;
    setPortalRoot(div);
    return () => {
      document.body.removeChild(div);
    };
  }, []);

  const startSession = useCallback((call: RtcCall, participantRole: ParticipantRole, onEnded?: () => void) => {
    setSession((current) => {
      if (current && current.call.id === call.id) {
        return { call, participantRole, onEnded: onEnded ?? current.onEnded };
      }
      return { call, participantRole, onEnded };
    });
  }, []);

  const registerAnchor = useCallback((el: HTMLElement | null) => {
    setAnchorEl(el);
  }, []);

  const handleCallEnded = useCallback(() => {
    sessionRef.current?.onEnded?.();
    setSession(null);
  }, []);

  // Keep the persistent container visually matched to the anchor's position
  // (docked/"full" look) or reset it to let the floating bar's own fixed
  // top-left CSS take over.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function sync() {
      if (!container) return;
      if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        container.style.position = 'fixed';
        container.style.top = `${rect.top}px`;
        container.style.left = `${rect.left}px`;
        container.style.width = `${rect.width}px`;
        container.style.height = `${rect.height}px`;
        container.style.zIndex = '5';
      } else {
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '0';
        container.style.height = '0';
        container.style.zIndex = '9000';
      }
    }

    sync();
    if (!anchorEl) return;

    const observer = new ResizeObserver(sync);
    observer.observe(anchorEl);
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [anchorEl]);

  return (
    <CallSessionContext.Provider value={{ hasSession: Boolean(session), startSession, registerAnchor }}>
      {children}
      {portalRoot && session
        ? createPortal(
            <WebRtcCallRoom
              call={session.call}
              onCallEnded={handleCallEnded}
              participantRole={session.participantRole}
              variant={anchorEl ? 'full' : 'floating'}
            />,
            portalRoot,
          )
        : null}
    </CallSessionContext.Provider>
  );
}

export function useCallSession() {
  const context = useContext(CallSessionContext);
  if (!context) throw new Error('useCallSession must be used within CallSessionProvider');
  return context;
}
