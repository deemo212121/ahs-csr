'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { fetchJsonWithFirebase, type AuthTokenUser } from '@/lib/auth/client';
import { NOTIFY_CHANNELS } from './broadcast';
import type { NotificationCategory } from './settings';

const LAST_SEEN_PREFIX = 'ushs-notify-seen-';
const BROADCAST_CHANNEL_NAME = 'ushs-notifications';
const POLL_FALLBACK_MS = 25000;
const JUST_ARRIVED_MS = 4000;

function lastSeenKey(category: NotificationCategory) {
  return `${LAST_SEEN_PREFIX}${category}`;
}

function getLastSeen(category: NotificationCategory): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(lastSeenKey(category));
  return raw ? Number(raw) || 0 : 0;
}

function setLastSeen(category: NotificationCategory, at: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(lastSeenKey(category), String(at));
}

export type FeedItem = { id: string; at: string; label: string; region?: string | null };

type FetchResult = { items: FeedItem[]; latestAt: number };

type RawRequest = { id: string; requested_at?: string; created_at?: string; full_name?: string; region?: string | null; city?: string | null };
type RawThread = { id: string; last_message_at: string | null; customer_name: string | null; subject: string };
type RawCall = { id: string; status: string; queued_at: string; customer_name: string };

function latestTimestamp(items: FeedItem[]) {
  return items.reduce((max, item) => Math.max(max, new Date(item.at).getTime() || 0), 0);
}

async function fetchVerify(user: AuthTokenUser): Promise<FetchResult> {
  try {
    const data = await fetchJsonWithFirebase<{ requests?: RawRequest[] }>(
      user,
      '/api/service-requests?verification_status=pending&limit=100',
    );
    const items: FeedItem[] = (data.requests ?? []).map((r) => ({
      id: String(r.id),
      at: r.requested_at || r.created_at || '',
      label: r.full_name || 'New request',
      region: r.region ?? r.city ?? null,
    }));
    return { items, latestAt: latestTimestamp(items) };
  } catch {
    return { items: [], latestAt: 0 };
  }
}

async function fetchMessages(user: AuthTokenUser): Promise<FetchResult> {
  try {
    const data = await fetchJsonWithFirebase<{ threads?: RawThread[] }>(user, '/api/messages/threads?limit=150');
    const items: FeedItem[] = (data.threads ?? [])
      .filter((t) => Boolean(t.last_message_at))
      .map((t) => ({ id: String(t.id), at: t.last_message_at as string, label: t.customer_name || t.subject }));
    return { items, latestAt: latestTimestamp(items) };
  } catch {
    return { items: [], latestAt: 0 };
  }
}

async function fetchCalls(user: AuthTokenUser): Promise<FetchResult> {
  try {
    const data = await fetchJsonWithFirebase<{ calls?: RawCall[] }>(user, '/api/calls');
    const openCalls = (data.calls ?? []).filter((c) => c.status === 'manager_queue');
    const items: FeedItem[] = openCalls.map((c) => ({ id: String(c.id), at: c.queued_at, label: c.customer_name }));
    return { items, latestAt: latestTimestamp(items) };
  } catch {
    return { items: [], latestAt: 0 };
  }
}

function fetchForCategory(category: NotificationCategory, user: AuthTokenUser) {
  if (category === 'verify') return fetchVerify(user);
  if (category === 'messages') return fetchMessages(user);
  return fetchCalls(user);
}

export type NotificationFeedState = {
  count: number;
  items: FeedItem[];
  justArrived: boolean;
  markRead: () => void;
};

export type NotificationFeedOptions = {
  enabled?: boolean;
  // Fired exactly once per genuine new item (not on first load, not on a
  // refetch/reconnect that finds nothing new). The hook only detects data;
  // it's up to the caller to decide what to do about it (play a sound,
  // push a toast, etc) - keeps this hook focused on one job.
  onNewArrival?: () => void;
  // Fired when items that were previously in the list are no longer present
  // (e.g. a pending ticket was approved/rejected). Not fired on first load.
  onItemsProcessed?: () => void;
  // Only count/fire callbacks for items whose region matches one of these.
  // Empty array = no filter (all regions).
  regionFilter?: string[];
};

export function useNotificationFeed(
  category: NotificationCategory,
  user: AuthTokenUser | null,
  options: NotificationFeedOptions = {},
): NotificationFeedState {
  const { enabled = true, onNewArrival, onItemsProcessed, regionFilter } = options;
  const [items, setItems] = useState<FeedItem[]>([]);
  const [lastSeen, setLastSeenState] = useState(0);
  const [justArrived, setJustArrived] = useState(false);
  const knownLatestRef = useRef(0);
  const prevItemIdsRef = useRef<string[]>([]);
  const justArrivedTimerRef = useRef<number | null>(null);
  const onNewArrivalRef = useRef(onNewArrival);
  onNewArrivalRef.current = onNewArrival;
  const onItemsProcessedRef = useRef(onItemsProcessed);
  onItemsProcessedRef.current = onItemsProcessed;
  const regionFilterRef = useRef(regionFilter);
  regionFilterRef.current = regionFilter;
  // `user` (a Firebase/Supabase auth object) is not guaranteed to be
  // referentially stable across renders - e.g. Firebase's onAuthStateChanged
  // can re-fire with a new object on every token refresh. If `refresh`
  // depended on `user` directly, every one of those would tear down and
  // reopen the Supabase Realtime websocket + restart the poll interval +
  // recreate the BroadcastChannel (all three effects below key off
  // `refresh`'s identity) - a connection-churn storm that gets worse the
  // longer a tab stays open. Reading the latest user via a ref keeps
  // `refresh` stable across that churn while still using a fresh token.
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    setLastSeenState(getLastSeen(category));
  }, [category]);

  const refresh = useCallback(async () => {
    const currentUser = userRef.current;
    if (!enabled || !currentUser) return;
    const result = await fetchForCategory(category, currentUser);

    const activeRegions = regionFilterRef.current;
    const filtered =
      activeRegions && activeRegions.length > 0
        ? result.items.filter((item) => !item.region || activeRegions.includes(item.region))
        : result.items;

    setItems(filtered);

    const isFirstLoad = knownLatestRef.current === 0;
    const filteredLatest = latestTimestamp(filtered);

    if (!isFirstLoad) {
      // Detect items removed from the list (e.g. ticket approved/rejected).
      const prevIds = prevItemIdsRef.current;
      const newIdSet = new Set(filtered.map((i) => i.id));
      if (prevIds.length > 0 && prevIds.some((id) => !newIdSet.has(id))) {
        onItemsProcessedRef.current?.();
      }
    }

    prevItemIdsRef.current = filtered.map((i) => i.id);

    if (filteredLatest > knownLatestRef.current) {
      knownLatestRef.current = filteredLatest;
      if (!isFirstLoad) {
        onNewArrivalRef.current?.();
        setJustArrived(true);
        if (justArrivedTimerRef.current) window.clearTimeout(justArrivedTimerRef.current);
        justArrivedTimerRef.current = window.setTimeout(() => setJustArrived(false), JUST_ARRIVED_MS);
      }
    }
  }, [category, enabled]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), POLL_FALLBACK_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  // `refresh` is deliberately stable across `user` churn (see userRef above),
  // so the mount-time effect above won't re-fire just because `user` later
  // becomes available (e.g. PortalShell renders while auth is still
  // resolving) - this effect exists to catch exactly that one transition.
  // It's keyed on whether we've *ever* had a user, not on `user`'s identity,
  // so a same-person token refresh (a new object, same login) doesn't queue
  // up another redundant fetch on top of the regular poll/realtime cycle.
  const hadUserRef = useRef(false);
  useEffect(() => {
    if (user && !hadUserRef.current) {
      hadUserRef.current = true;
      void refresh();
    } else if (!user) {
      hadUserRef.current = false;
    }
  }, [user, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(NOTIFY_CHANNELS[category])
      .on('broadcast', { event: 'ping' }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [category, refresh, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    bc.onmessage = (event: MessageEvent<{ category: NotificationCategory; type: 'read' | 'refresh' }>) => {
      if (event.data?.category !== category) return;
      if (event.data.type === 'read') setLastSeenState(getLastSeen(category));
      if (event.data.type === 'refresh') void refresh();
    };
    return () => bc.close();
  }, [category, refresh, enabled]);

  const markRead = useCallback(() => {
    const now = Date.now();
    setLastSeen(category, now);
    setLastSeenState(now);
    setJustArrived(false);
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ category, type: 'read' });
      bc.close();
    }
  }, [category]);

  // Open calls represent work nobody has handled yet - they stay counted
  // until accepted/missed, not just until someone glances at the page.
  const count =
    category === 'calls' ? items.length : items.filter((item) => (new Date(item.at).getTime() || 0) > lastSeen).length;

  return { count, items, justArrived, markRead };
}
