'use client';

import { Bell, BellOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import { isNativePlatform } from '@/lib/biometric';
import { pushUnsupportedReason, subscribeToPush } from '@/lib/push/subscribe';

type Status = 'unsupported' | 'denied' | 'off' | 'on';

// The persistent control for push notifications — the banner
// (PushNotificationOptIn) only ever offers once and can be dismissed, so
// this is the only way back in for anyone who dismissed it, said no by
// mistake, or wants to confirm it's actually on. Always renders something
// (even when unsupported) with the specific reason why, rather than quietly
// vanishing — a silent no-op here looks identical to a broken button.
export function PushNotificationToggle() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('off');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupportedReason, setUnsupportedReason] = useState<string | null>(null);

  useEffect(() => {
    if (isNativePlatform()) {
      setUnsupportedReason('Push notifications are not available inside the installed app — this only works when visiting the site in a mobile browser.');
      setStatus('unsupported');
      return;
    }
    const reason = pushUnsupportedReason();
    if (reason) {
      setUnsupportedReason(reason);
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    navigator.serviceWorker.getRegistration('/push-sw.js').then(async (registration) => {
      const subscription = await registration?.pushManager.getSubscription();
      setStatus(subscription ? 'on' : 'off');
    });
  }, []);

  if (!user) return null;

  async function enable() {
    if (!user) return;
    setError(null);
    setBusy(true);
    try {
      const { subscription, error: subError } = await subscribeToPush();
      if (!subscription) {
        setError(subError || 'Could not enable notifications.');
        setStatus(Notification.permission === 'denied' ? 'denied' : 'off');
        return;
      }
      await fetchJsonWithFirebase(user, '/api/me/push-subscription', {
        method: 'POST',
        body: JSON.stringify(subscription),
      });
      setStatus('on');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to enable notifications.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!user) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetchJsonWithFirebase(user, '/api/me/push-subscription', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint }),
        });
      }
      setStatus('off');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="push-toggle-row">
      <div className="push-toggle-label">
        {status === 'on' ? <Bell size={16} /> : <BellOff size={16} />}
        <span>Push notifications for new messages and calls</span>
      </div>
      {error ? <div className="customer-alert push-toggle-error">{error}</div> : null}
      {status === 'unsupported' ? (
        <small className="push-toggle-hint">{unsupportedReason}</small>
      ) : status === 'denied' ? (
        <small className="push-toggle-hint">Blocked in your browser's site settings for this site.</small>
      ) : (
        <label className="push-toggle-switch">
          <span className="toggle-switch">
            <input
              checked={status === 'on'}
              disabled={busy}
              onChange={(event) => void (event.target.checked ? enable() : disable())}
              type="checkbox"
            />
            <span className="toggle-switch-track" />
          </span>
          <span>{status === 'on' ? 'On' : 'Off'}</span>
        </label>
      )}
    </div>
  );
}
