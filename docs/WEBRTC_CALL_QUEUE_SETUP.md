# WebRTC call queue setup

This feature uses the main/customer Supabase database for customer call requests and reads ER service-area data only for branch routing.

Run this SQL once in the main Supabase project:

- `supabase/webrtc_call_queue_setup.sql`

Do not run it in the ER / ah-solutions database.

## Metered TURN env

Recommended option:

```env
METERED_TURN_REST_URL=https://YOUR_METERED_APP.metered.live/api/v1/turn/credentials
METERED_TURN_API_KEY=YOUR_METERED_TURN_API_KEY
```

Alternative if you copied the full ICE server array from Metered:

```env
METERED_TURN_ICE_SERVERS_JSON=[{"urls":"stun:..."},{"urls":"turn:...","username":"...","credential":"..."}]
```

After editing `.env.local`, restart `npm run dev`.

The browser receives only the ICE server list from `/api/calls/ice`; the Metered API key stays server-side.

## Recordings

Call recording is staff-side browser recording. When the WebRTC room connects, the CSR/Manager/TL browser mixes its microphone plus the customer audio, records it, and uploads it after the call ends.

The upload API saves files to a private Supabase Storage bucket:

```env
CALL_RECORDINGS_BUCKET=call-recordings
```

If this env value is missing, the app uses `call-recordings`. The API will try to create the bucket automatically using the Supabase service-role key. The recording path and MIME type are saved on `public.call_requests`, which is already covered by `supabase/webrtc_call_queue_setup.sql`.

If the call room shows `Bucket not found`, create a private Supabase Storage bucket named `call-recordings` in the main/customer Supabase project, or rerun `supabase/webrtc_call_queue_setup.sql` in that same project.
