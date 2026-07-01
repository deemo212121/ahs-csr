'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { ToastItem } from '@/lib/notifications/useToastQueue';
import type { NotificationCategory } from '@/lib/notifications/settings';

const TOAST_CONTENT: Record<NotificationCategory, { icon: string; title: string; body: string; path: string }> = {
  verify: { icon: '✅', title: 'New Ticket Submitted', body: 'Please verify the newly submitted ticket.', path: '/verification' },
  messages: { icon: '💬', title: 'New Customer Message', body: 'You have received a new unread message.', path: '/messages' },
  calls: { icon: '📞', title: 'New Call Queued', body: 'A customer is waiting in the call queue.', path: '/calls' },
};

const VISIBLE_MS = 4000;
const LEAVE_ANIMATION_MS = 280;

function ToastCard({
  toast,
  basePath,
  onDismiss,
  onMarkRead,
}: {
  toast: ToastItem;
  basePath: string;
  onDismiss: (id: string) => void;
  onMarkRead: (category: NotificationCategory) => void;
}) {
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const remainingRef = useRef(VISIBLE_MS);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function startLeaving() {
    clearTimer();
    setLeaving(true);
    window.setTimeout(() => onDismiss(toast.id), LEAVE_ANIMATION_MS);
  }

  function startTimer(duration: number) {
    clearTimer();
    startedAtRef.current = Date.now();
    remainingRef.current = duration;
    timerRef.current = window.setTimeout(startLeaving, duration);
  }

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    startTimer(VISIBLE_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimer();
    };
    // Intentionally mount-only: this card's lifecycle starts once and runs
    // its own timer; it doesn't need to react to prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMouseEnter() {
    if (leaving || timerRef.current === null) return;
    clearTimer();
    const elapsed = Date.now() - startedAtRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
  }

  function handleMouseLeave() {
    if (leaving) return;
    startTimer(remainingRef.current);
  }

  const content = TOAST_CONTENT[toast.category];

  function handleCardClick() {
    onMarkRead(toast.category);
    onDismiss(toast.id);
    router.push(`${basePath}${content.path}`);
  }

  function handleCloseClick(event: React.MouseEvent) {
    event.stopPropagation();
    startLeaving();
  }

  return (
    <div
      className={`notification-toast ${entered ? 'entered' : ''} ${leaving ? 'leaving' : ''}`}
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
    >
      <span className="notification-toast-icon">{content.icon}</span>
      <div className="notification-toast-copy">
        <strong>{content.title}</strong>
        <span>{content.body}</span>
      </div>
      <button aria-label="Dismiss notification" className="notification-toast-close" onClick={handleCloseClick} type="button">
        <X size={14} />
      </button>
    </div>
  );
}

export function NotificationToastStack({
  toasts,
  basePath,
  onDismiss,
  onMarkRead,
}: {
  toasts: ToastItem[];
  basePath: string;
  onDismiss: (id: string) => void;
  onMarkRead: (category: NotificationCategory) => void;
}) {
  if (!toasts.length) return null;
  return (
    <div aria-live="polite" className="notification-toast-stack">
      {toasts.map((toast) => (
        <ToastCard basePath={basePath} key={toast.id} onDismiss={onDismiss} onMarkRead={onMarkRead} toast={toast} />
      ))}
    </div>
  );
}
