'use client';

import { Bell, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import { isNativePlatform } from '@/lib/biometric';
import { pushUnsupportedReason, subscribeToPush } from '@/lib/push/subscribe';

const DISMISS_KEY = 'ushs-push-optin-dismissed';

// Browser/PWA notifications only — the wrapped native app has its own,
// separate biometric-login feature and no push wiring yet. Shown once per
// browser (until dismissed or enabled) for a logged-in user whose browser
// supports Web Push and hasn't already decided on notification permission.
export function PushNotificationOptIn() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || isNativePlatform() || pushUnsupportedReason()) return;
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(DISMISS_KEY)) return;
    if (Notification.permission !== 'default') return;
    setVisible(true);
  }, [user]);

  if (!visible || !user) return null;

  async function enable() {
    setBusy(true);
    try {
      const { subscription } = await subscribeToPush();
      if (subscription) {
        await fetchJsonWithFirebase(user!, '/api/me/push-subscription', {
          method: 'POST',
          body: JSON.stringify(subscription),
        });
      }
    } finally {
      setBusy(false);
      setVisible(false);
    }
  }

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, 'true');
    setVisible(false);
  }

  return (
    <div className="push-optin-banner">
      <Bell size={16} />
      <span>Get notified about new messages and calls, even when this tab isn't open.</span>
      <button disabled={busy} onClick={() => void enable()} type="button">
        {busy ? 'Enabling...' : 'Enable'}
      </button>
      <button aria-label="Dismiss" className="push-optin-dismiss" onClick={dismiss} type="button">
        <X size={14} />
      </button>
    </div>
  );
}
