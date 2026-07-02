'use client';

import { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useNotificationFeed, type NotificationFeedState } from '@/lib/notifications/useNotificationFeed';
import { useNotificationHistory } from '@/lib/notifications/useNotificationHistory';
import { useToastQueue } from '@/lib/notifications/useToastQueue';
import { playNotificationSound } from '@/lib/notifications/sounds';
import { dispatchLiveUpdate } from '@/lib/notifications/useLiveUpdate';
import { NotificationToastStack } from '@/components/NotificationToastStack';
import type { NotificationCategory } from '@/lib/notifications/settings';
import type { AppRole } from '@/lib/types';

function getRoleBase(role: AppRole | null) {
  if (role === 'team_leader') return '/team-leader';
  if (role === 'csr_manager') return '/manager';
  if (role === 'csr') return '/csr';
  if (role === 'admin') return '/admin';
  return '/customer';
}

type NotificationsContextValue = {
  verifyFeed: NotificationFeedState;
  messagesFeed: NotificationFeedState;
  callsFeed: NotificationFeedState;
  notifHistory: ReturnType<typeof useNotificationHistory>;
  liveNotificationCount: number;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

// Mounted once at the app root (see app/layout.tsx) so the notification
// polling, realtime subscriptions, and toast queue survive page navigation
// instead of being torn down and rebuilt every time PortalShell remounts
// inside a new page — which was silently dropping toasts and resetting the
// "what's new" baseline on every route change.
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, role, profile } = useAuth();
  const isAgentPortal = role === 'csr' || role === 'team_leader' || role === 'csr_manager';
  const base = getRoleBase(role);
  const regionFilter = profile?.preferences?.filterRegions ?? [];

  const toastQueue = useToastQueue(3);
  const notifHistory = useNotificationHistory(base);

  function onArrival(category: NotificationCategory) {
    playNotificationSound(category);
    toastQueue.push(category);
    notifHistory.addRecord(category);
    dispatchLiveUpdate(category);
  }

  const verifyFeed = useNotificationFeed('verify', user, {
    enabled: isAgentPortal,
    onNewArrival: () => onArrival('verify'),
    onItemsProcessed: () => playNotificationSound('verify'),
    regionFilter,
  });
  const messagesFeed = useNotificationFeed('messages', user, {
    enabled: isAgentPortal,
    onNewArrival: () => onArrival('messages'),
  });
  const callsFeed = useNotificationFeed('calls', user, {
    enabled: isAgentPortal,
    onNewArrival: () => onArrival('calls'),
    regionFilter,
  });

  const liveNotificationCount = verifyFeed.count + messagesFeed.count + callsFeed.count;

  const value = useMemo<NotificationsContextValue>(
    () => ({ verifyFeed, messagesFeed, callsFeed, notifHistory, liveNotificationCount }),
    [verifyFeed, messagesFeed, callsFeed, notifHistory, liveNotificationCount],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      {isAgentPortal ? (
        <NotificationToastStack
          basePath={base}
          onDismiss={toastQueue.dismiss}
          onMarkRead={(cat: NotificationCategory) => {
            if (cat === 'verify') verifyFeed.markRead();
            if (cat === 'messages') messagesFeed.markRead();
            if (cat === 'calls') callsFeed.markRead();
          }}
          toasts={toastQueue.visible}
        />
      ) : null}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider.');
  return context;
}
