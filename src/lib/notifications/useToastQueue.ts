'use client';

import { useCallback, useEffect, useState } from 'react';
import type { NotificationCategory } from './settings';

export type ToastItem = {
  id: string;
  category: NotificationCategory;
  createdAt: number;
};

let toastIdCounter = 0;
function nextToastId() {
  toastIdCounter += 1;
  return `toast-${Date.now()}-${toastIdCounter}`;
}

// Newest-on-top, max `maxVisible` shown at once - anything beyond that
// waits in `queue` and gets promoted the moment a visible slot frees up
// (a toast auto-dismisses or is closed).
export function useToastQueue(maxVisible = 3) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [visible, setVisible] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (visible.length >= maxVisible || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setVisible((current) => [next, ...current]);
  }, [queue, visible.length, maxVisible]);

  const push = useCallback((category: NotificationCategory) => {
    const item: ToastItem = { id: nextToastId(), category, createdAt: Date.now() };
    setQueue((current) => [...current, item]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setVisible((current) => current.filter((item) => item.id !== id));
  }, []);

  return { visible, push, dismiss };
}
