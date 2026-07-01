// Lightweight "something changed" pings over Supabase Realtime Broadcast.
//
// Why broadcast instead of postgres_changes: rtc_calls, rtc_signals, and
// portal_service_requests have RLS enabled with no policies (deny-all) by
// design, specifically to keep the browser from querying them directly -
// see the comments in supabase/rtc_calls_setup.sql and
// er_portal_service_requests_setup.sql. postgres_changes realtime would
// require loosening that. Broadcast doesn't read the table at all - it's
// just an event the server fires after a write, telling clients "go
// refetch via the API routes you already trust" rather than carrying any
// row data itself.
//
// Why a raw fetch on the server instead of the supabase-js client: opening
// a websocket per request just to send one broadcast is wasteful (and
// awkward) inside a Cloudflare Worker request lifecycle. Supabase's
// Realtime server also accepts broadcasts over a plain authenticated HTTP
// endpoint, which fits the request/response model Workers actually use.

export const NOTIFY_CHANNELS = {
  verify: 'notify:verify',
  messages: 'notify:messages',
  calls: 'notify:calls',
} as const;

export type NotifyChannel = (typeof NOTIFY_CHANNELS)[keyof typeof NOTIFY_CHANNELS];

export async function pingChannel(channel: NotifyChannel) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  try {
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ topic: channel, event: 'ping', payload: { at: new Date().toISOString() }, private: false }],
      }),
    });
  } catch {
    // A missed ping just means clients fall back to their next scheduled
    // poll - never let this break the actual request that triggered it.
  }
}
