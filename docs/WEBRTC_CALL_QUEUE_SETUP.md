# WebRTC call queue setup

This feature uses the main/customer Supabase database for customer call requests and reads ER service-area data only for branch routing.

Run this SQL once in the main Supabase project:

- `supabase/rtc_calls_setup.sql`

Do not run it in the ER / ah-solutions database.

This is a from-scratch rebuild of the calling system (`rtc_calls` / `rtc_signals`), kept separate from the original `call_requests` / `call_signals` tables (`supabase/webrtc_call_queue_setup.sql`). The originals are left untouched in the database but are no longer used by the app — there's no need to run that older script for new installs.

Recording is not implemented in this version. It can be reintroduced later as a separate feature without changing the connection/signaling tables.

## TURN env

`/api/calls/ice` tries these in order, so set whichever matches your provider:

1. A full ICE server array, if you copied one directly from your TURN provider:

   ```env
   METERED_TURN_ICE_SERVERS_JSON=[{"urls":"stun:..."},{"urls":"turn:...","username":"...","credential":"..."}]
   ```

2. Cloudflare Realtime TURN (recommended — runs on Cloudflare's own infrastructure rather than a shared free relay):

   ```env
   CLOUDFLARE_TURN_KEY_ID=YOUR_TURN_KEY_ID
   CLOUDFLARE_TURN_API_TOKEN=YOUR_TURN_API_TOKEN
   ```

3. Metered's dynamic per-call credential endpoint:

   ```env
   METERED_TURN_REST_URL=https://YOUR_METERED_APP.metered.live/api/v1/turn/credentials
   METERED_TURN_API_KEY=YOUR_METERED_TURN_API_KEY
   ```

4. A static host + credential pair — works for any TURN provider (Metered static creds, ExpressTurn, coturn, etc.) despite the `METERED_` prefix in the var names:

   ```env
   METERED_TURN_HOST=free.expressturn.com:3478
   METERED_TURN_USERNAME=...
   METERED_TURN_CREDENTIAL=...
   ```

   If the host string includes a port (as ExpressTurn's does), it's used exactly as given. If it's a bare hostname (as Metered's relay is), `:80`/`:443`/`turns:443` variants are added automatically.

Each tier is tried independently — if one fails (bad credentials, rate limit, transient error), the route falls through to the next tier instead of giving up and returning a plain STUN-only fallback.

After editing `.env.local`, restart `npm run dev`. On Cloudflare, set credentials with `wrangler secret put` rather than `wrangler.jsonc`'s plaintext `vars` — hostnames/key IDs alone aren't sensitive, but tokens/credentials are.

The browser only ever receives the resolved ICE server list from `/api/calls/ice`; TURN credentials stay server-side.

## Debugging a stuck/dropped connection

`WebRtcCallRoom` logs every `connectionState`/`iceConnectionState` transition to the browser console as `[webrtc:staff]`/`[webrtc:customer]`. Open DevTools Console (not just Network) on both ends during a test call — if it drops, those logs show whether it's a real `failed` ICE transition (network/TURN issue) versus something else.
