'use client';

import { useEffect, useState } from 'react';
import { fetchJsonWithFirebase, type AuthTokenUser } from '@/lib/auth/client';

const ONLINE_WINDOW_MS = 90_000;
const POLL_INTERVAL_MS = 30_000;

export function isPresenceOnline(lastSeenAt?: string | null) {
  if (!lastSeenAt) return false;
  const seen = new Date(lastSeenAt).getTime();
  if (Number.isNaN(seen)) return false;
  return Date.now() - seen <= ONLINE_WINDOW_MS;
}

// Fetches last_seen_at for a set of customer profile ids so CSR staff can
// prioritize customers who are currently online in the portal.
export function usePresenceMap(user: AuthTokenUser | null, customerIds: string[]) {
  const [presence, setPresence] = useState<Record<string, string | null>>({});

  const key = [...new Set(customerIds.filter(Boolean))].sort().join(',');

  useEffect(() => {
    if (!user || !key) return;
    const authUser = user;
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchJsonWithFirebase<{ presence: Record<string, string | null> }>(
          authUser,
          `/api/customers/presence?ids=${encodeURIComponent(key)}`,
        );
        if (!cancelled) setPresence(data.presence);
      } catch {
        // presence is a nice-to-have; ignore failures
      }
    }

    void load();
    const interval = window.setInterval(() => {
      if (!cancelled) void load();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user, key]);

  return presence;
}
