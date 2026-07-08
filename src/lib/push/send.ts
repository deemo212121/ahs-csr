import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileSource } from '@/lib/auth/server';

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

// web-push's sendNotification() signs a brand-new ECDSA VAPID JWT on every
// single call, with no caching — fine for one-off sends, but sending one
// event to a company's whole staff roster meant dozens of independent
// signing operations in a single Worker invocation, which is exactly what
// blew through Cloudflare's per-request CPU time limit (error 1102). VAPID
// audience is just the push service's origin (basically one of a handful of
// values — fcm.googleapis.com, Mozilla's push service, etc), and the JWT is
// valid for hours, so it's safe and correct to sign it once per audience and
// reuse it for every recipient on that push service within the cache window.
const vapidAuthCache = new Map<string, { authorization: string; expiresAt: number }>();
const VAPID_JWT_TTL_SECONDS = 11 * 60 * 60; // under web-push's own 12h default, with headroom

function getCachedVapidAuthorization(audience: string): string {
  const now = Date.now();
  const cached = vapidAuthCache.get(audience);
  if (cached && cached.expiresAt > now) return cached.authorization;

  const headers = webpush.getVapidHeaders(
    audience,
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
    'aes128gcm',
    Math.floor(now / 1000) + VAPID_JWT_TTL_SECONDS,
  );
  vapidAuthCache.set(audience, {
    authorization: headers.Authorization,
    // Refresh a minute early so a cached header is never presented right at
    // the edge of its own expiry.
    expiresAt: now + (VAPID_JWT_TTL_SECONDS - 60) * 1000,
  });
  return headers.Authorization;
}

type StoredSubscription = { id: string; endpoint: string; p256dh: string; auth: string };

// Delivers via fetch rather than web-push's own sendNotification (which uses
// Node's https.request internally) — fetch is the primitive Workers actually
// runs natively. Encryption is still done per-subscription (it's keyed to
// each browser's unique p256dh/auth, genuinely can't be shared), only the
// VAPID signing is reused.
async function deliverPush(sub: StoredSubscription, payload: string) {
  const audience = new URL(sub.endpoint).origin;
  const authorization = getCachedVapidAuthorization(audience);

  // The type declarations don't account for it, but web-push's own source
  // explicitly supports a falsy vapidDetails to skip its internal (uncached)
  // signing and use the Authorization header supplied in `headers` instead
  // — see node_modules/web-push/src/web-push-lib.js.
  const requestOptions = { vapidDetails: false, headers: { Authorization: authorization } } as unknown as webpush.RequestOptions;
  const requestDetails = webpush.generateRequestDetails(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    payload,
    requestOptions,
  );

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(requestDetails.headers)) {
    headers[key] = String(value);
  }

  const response = await fetch(requestDetails.endpoint, {
    method: requestDetails.method,
    headers,
    body: requestDetails.body as BodyInit,
  });

  if (!response.ok) {
    const error = new Error(`Push delivery failed with ${response.status}`) as Error & { statusCode?: number };
    error.statusCode = response.status;
    throw error;
  }
}

async function sendToSubscriptions(
  supabaseAdmin: SupabaseClient,
  subs: StoredSubscription[],
  payload: PushPayload,
) {
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await deliverPush(sub, body);
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }),
  );
}

// Sends to every subscribed device/browser for one profile (a person may
// have push enabled on more than one). Best-effort — a dead/expired
// subscription is deleted so it stops being retried, but never throws back
// to the caller (a notification failing to send should never break the
// action that triggered it, e.g. sending a message).
export async function sendPushToProfile(
  supabaseAdmin: SupabaseClient,
  profileId: string,
  profileSource: ProfileSource,
  payload: PushPayload,
) {
  if (!isConfigured()) return;

  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('profile_id', profileId)
    .eq('profile_source', profileSource);

  if (error || !subs?.length) return;
  await sendToSubscriptions(supabaseAdmin, subs, payload);
}

// Same as above, but for every profile in a list at once (e.g. every active
// staff member at a company) — used for "new call in queue"-style pushes
// that don't have one single recipient. One batched lookup instead of one
// query per profile, on top of the shared VAPID signing above.
export async function sendPushToProfiles(
  supabaseAdmin: SupabaseClient,
  profiles: Array<{ id: string; source: ProfileSource }>,
  payload: PushPayload,
) {
  if (!isConfigured() || !profiles.length) return;

  const sourceGroups = new Map<ProfileSource, string[]>();
  for (const profile of profiles) {
    const ids = sourceGroups.get(profile.source) ?? [];
    ids.push(profile.id);
    sourceGroups.set(profile.source, ids);
  }

  const results = await Promise.all(
    Array.from(sourceGroups.entries()).map(([source, ids]) =>
      supabaseAdmin
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('profile_source', source)
        .in('profile_id', ids),
    ),
  );

  const subs = results.flatMap((result) => result.data ?? []);
  if (!subs.length) return;
  await sendToSubscriptions(supabaseAdmin, subs, payload);
}
