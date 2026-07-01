'use client';

import { useEffect } from 'react';
import { fetchJsonWithFirebase, type AuthTokenUser } from '@/lib/auth/client';

const HEARTBEAT_INTERVAL_MS = 30_000;

// Pings the server every 30s so the customer's account shows as "online"
// to CSR staff (see ONLINE_WINDOW_MS in usePresenceMap). Best-effort: a
// failed ping just means the customer will look offline a bit sooner.
export function usePresenceHeartbeat(user: AuthTokenUser | null, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !user) return;
    const authUser = user;
    let cancelled = false;

    async function ping() {
      try {
        await fetchJsonWithFirebase(authUser, '/api/me/presence', { method: 'POST' });
      } catch {
        // ignore — presence is best-effort
      }
    }

    void ping();
    const interval = window.setInterval(() => {
      if (!cancelled) void ping();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user, enabled]);
}
