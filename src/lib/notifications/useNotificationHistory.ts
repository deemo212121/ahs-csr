'use client';

import { useCallback, useRef, useState } from 'react';
import type { NotificationCategory } from './settings';

export type NotificationRecord = {
  id: string;
  category: NotificationCategory;
  icon: string;
  title: string;
  body: string;
  href: string;
  at: number;
  isRead: boolean;
};

const ICONS: Record<NotificationCategory, string> = {
  verify: '✅',
  messages: '💬',
  calls: '📞',
};

const TITLES: Record<NotificationCategory, string> = {
  verify: 'New Ticket Submitted',
  messages: 'New Customer Message',
  calls: 'New Call Queued',
};

const BODIES: Record<NotificationCategory, string> = {
  verify: 'A ticket is waiting in the Verification Queue.',
  messages: 'You have received a new unread message.',
  calls: 'A customer is waiting in the call queue.',
};

const PATHS: Record<NotificationCategory, string> = {
  verify: '/verification',
  messages: '/messages',
  calls: '/calls',
};

let idCounter = 0;

export function useNotificationHistory(basePath: string) {
  const [records, setRecords] = useState<NotificationRecord[]>([]);
  const basePathRef = useRef(basePath);
  basePathRef.current = basePath;

  const addRecord = useCallback((category: NotificationCategory) => {
    idCounter += 1;
    const record: NotificationRecord = {
      id: `notif-${Date.now()}-${idCounter}`,
      category,
      icon: ICONS[category],
      title: TITLES[category],
      body: BODIES[category],
      href: `${basePathRef.current}${PATHS[category]}`,
      at: Date.now(),
      isRead: false,
    };
    setRecords((prev) => [record, ...prev].slice(0, 50));
  }, []);

  const markAllRead = useCallback(() => {
    setRecords((prev) => prev.map((r) => ({ ...r, isRead: true })));
  }, []);

  const markOneRead = useCallback((id: string) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, isRead: true } : r)));
  }, []);

  const unreadCount = records.filter((r) => !r.isRead).length;

  return { records, addRecord, markAllRead, markOneRead, unreadCount };
}
