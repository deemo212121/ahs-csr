'use client';

import { useEffect, useRef } from 'react';
import type { NotificationCategory } from './settings';

export const LIVE_UPDATE_EVENT = 'ushs-live-update';

export type LiveUpdateDetail = { category: NotificationCategory };

// Dispatch a live-update event so any page that cares about this category
// can immediately refresh its data without a separate Supabase subscription.
export function dispatchLiveUpdate(category: NotificationCategory) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LiveUpdateDetail>(LIVE_UPDATE_EVENT, { detail: { category } }));
}

// Page components call this hook to react to live-update signals from
// PortalShell's onNewArrival callbacks. No extra Supabase subscription is
// created - the event crosses the PortalShell→page boundary via the
// browser's own event system.
export function useLiveUpdate(category: NotificationCategory | NotificationCategory[], onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const categories = Array.isArray(category) ? category : [category];

  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<LiveUpdateDetail>).detail;
      if (categories.includes(detail?.category)) {
        onUpdateRef.current();
      }
    }
    window.addEventListener(LIVE_UPDATE_EVENT, handler);
    return () => window.removeEventListener(LIVE_UPDATE_EVENT, handler);
    // categories is stable (string literals passed directly) - not in deps intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
