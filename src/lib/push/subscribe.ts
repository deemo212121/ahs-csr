'use client';

const SW_URL = '/push-sw.js';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
}

// Reports exactly which precondition is missing, instead of a single opaque
// boolean — the only way to tell a user on an unfamiliar device/browser why
// the notification toggle can't do anything.
export function pushUnsupportedReason(): string | null {
  if (typeof window === 'undefined') return 'Not running in a browser.';
  if (!('serviceWorker' in navigator)) return 'This browser does not support service workers (required for push).';
  if (!('PushManager' in window)) return 'This browser does not support the Push API. On iPhone, add this site to your Home Screen first (Share > Add to Home Screen) and open it from there — Safari does not support push from a regular browser tab.';
  if (typeof Notification === 'undefined') return 'This browser does not support notifications.';
  if (!window.isSecureContext) return 'This page is not loaded over HTTPS, so notifications are blocked.';
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return 'Push notifications are not configured on the server yet.';
  return null;
}

export async function subscribeToPush(): Promise<{ subscription: PushSubscriptionJSON | null; error: string | null }> {
  const reason = pushUnsupportedReason();
  if (reason) return { subscription: null, error: reason };

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch (err) {
    return { subscription: null, error: `Notification.requestPermission() threw: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (permission !== 'granted') {
    return { subscription: null, error: `Browser permission was "${permission}", not granted.` };
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_URL);
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    return { subscription: subscription.toJSON(), error: null };
  } catch (err) {
    return { subscription: null, error: err instanceof Error ? err.message : String(err) };
  }
}
