# WebRTC call queue setup

This feature uses the main/customer Supabase database for customer call requests and reads ER service-area data only for branch routing.

Run this SQL once in the main Supabase project:

- `supabase/webrtc_call_queue_setup.sql`

Do not run it in the ER / ah-solutions database.

## TURN env

`/api/calls/ice` tries these in order, so set whichever matches your provider:

1. A full ICE server array, if you copied one directly from your TURN provider:

   ```env
   METERED_TURN_ICE_SERVERS_JSON=[{"urls":"stun:..."},{"urls":"turn:...","username":"...","credential":"..."}]
   ```

2. Metered's dynamic per-call credential endpoint:

   ```env
   METERED_TURN_REST_URL=https://YOUR_METERED_APP.metered.live/api/v1/turn/credentials
   METERED_TURN_API_KEY=YOUR_METERED_TURN_API_KEY
   ```

3. A static host + credential pair — works for any TURN provider (Metered static creds, ExpressTurn, coturn, etc.) despite the `METERED_` prefix in the var names:

   ```env
   METERED_TURN_HOST=free.expressturn.com:3478
   METERED_TURN_USERNAME=...
   METERED_TURN_CREDENTIAL=...
   ```

   If the host string includes a port (as ExpressTurn's does), it's used exactly as given. If it's a bare hostname (as Metered's relay is), `:80`/`:443`/`turns:443` variants are added automatically.

After editing `.env.local`, restart `npm run dev`. On Cloudflare, set the username/credential with `wrangler secret put` rather than `wrangler.jsonc`'s plaintext `vars` — the host alone isn't sensitive, but the credential is.

The browser only ever receives the resolved ICE server list from `/api/calls/ice`; the TURN credential stays server-side.

## Recordings

Call recording is staff-side browser recording. When the WebRTC room connects, the CSR/Manager/TL browser mixes its microphone plus the customer audio, records it, and uploads it after the call ends.

The upload API saves files to a private Supabase Storage bucket:

```env
CALL_RECORDINGS_BUCKET=call-recordings
```

If this env value is missing, the app uses `call-recordings`. The API will try to create the bucket automatically using the Supabase service-role key. The recording path and MIME type are saved on `public.call_requests`, which is already covered by `supabase/webrtc_call_queue_setup.sql`.

If the call room shows `Bucket not found`, create a private Supabase Storage bucket named `call-recordings` in the main/customer Supabase project, or rerun `supabase/webrtc_call_queue_setup.sql` in that same project.
