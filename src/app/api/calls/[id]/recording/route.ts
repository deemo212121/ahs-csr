import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const recordingBucket = process.env.CALL_RECORDINGS_BUCKET?.trim() || 'call-recordings';

function baseMimeType(mime: string) {
  return mime.split(';')[0]?.trim().toLowerCase() || 'audio/webm';
}

function extensionForMime(mime: string) {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('mpeg')) return 'mp3';
  return 'webm';
}

function missingSchemaMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.toLowerCase().includes('bucket not found')) {
    return `Recording bucket "${recordingBucket}" was not found. Create it in Supabase Storage or re-run supabase/webrtc_call_queue_setup.sql in the main database.`;
  }
  if (message.includes('recording_path') || message.toLowerCase().includes('bucket') || message.toLowerCase().includes('storage')) {
    return `Call recording storage is not ready. Create the private Supabase Storage bucket "${recordingBucket}" and make sure supabase/webrtc_call_queue_setup.sql has been run.`;
  }
  return null;
}

async function ensureBucket() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) throw new Error(`Unable to list Supabase Storage buckets: ${listError.message}`);

  const exists = buckets?.some((bucket) => bucket.name === recordingBucket);
  if (!exists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(recordingBucket, {
      public: false,
      fileSizeLimit: 1024 * 1024 * 80,
      allowedMimeTypes: ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'video/webm'],
    });
    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw new Error(`Unable to create recording bucket "${recordingBucket}": ${createError.message}`);
    }
  }

  const { data: verifiedBuckets, error: verifyError } = await supabaseAdmin.storage.listBuckets();
  if (verifyError) throw new Error(`Unable to verify recording bucket: ${verifyError.message}`);
  if (!verifiedBuckets?.some((bucket) => bucket.name === recordingBucket)) {
    throw new Error(`Bucket not found: ${recordingBucket}`);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['csr', 'team_leader', 'csr_manager', 'admin']);

    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get('recording');
    if (!(file instanceof File)) throw new Error('Missing call recording file.');
    if (!file.size) throw new Error('Recording file is empty.');

    const mimeType = baseMimeType(file.type || 'audio/webm');
    const extension = extensionForMime(mimeType);
    const path = `${id}/${Date.now()}-${auth.profile.id}.${extension}`;
    const bytes = await file.arrayBuffer();

    await ensureBucket();

    const supabaseAdmin = getSupabaseAdmin();
    let { error: uploadError } = await supabaseAdmin.storage
      .from(recordingBucket)
      .upload(path, bytes, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError?.message.toLowerCase().includes('bucket not found')) {
      await ensureBucket();
      const retry = await supabaseAdmin.storage
        .from(recordingBucket)
        .upload(path, bytes, {
          contentType: mimeType,
          upsert: true,
        });
      uploadError = retry.error;
    }

    if (uploadError) throw new Error(uploadError.message);

    const { data, error } = await supabaseAdmin
      .from('call_requests')
      .update({
        recording_path: path,
        recording_mime: mimeType,
        recording_uploaded_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, recording_path, recording_mime, recording_uploaded_at')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ recording: data });
  } catch (error) {
    const setupMessage = missingSchemaMessage(error);
    return NextResponse.json(
      { message: setupMessage || (error instanceof Error ? error.message : 'Unable to save call recording.') },
      { status: 400 },
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['customer', 'csr', 'team_leader', 'csr_manager', 'admin']);

    const { id } = await context.params;
    const supabaseAdmin = getSupabaseAdmin();
    const { data: call, error } = await supabaseAdmin
      .from('call_requests')
      .select('id, customer_id, recording_path, recording_mime, recording_uploaded_at')
      .eq('id', id)
      .single();

    if (error || !call) throw new Error(error?.message ?? 'Call was not found.');
    if (auth.role === 'customer' && call.customer_id !== auth.profile.id) {
      throw new Error('You do not have access to this recording.');
    }
    if (!call.recording_path) {
      return NextResponse.json({ recording: null });
    }

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(recordingBucket)
      .createSignedUrl(call.recording_path, 60 * 15);

    if (signedError) throw new Error(signedError.message);

    return NextResponse.json({
      recording: {
        path: call.recording_path,
        mime: call.recording_mime,
        uploaded_at: call.recording_uploaded_at,
        signed_url: signed.signedUrl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load call recording.' },
      { status: 400 },
    );
  }
}
