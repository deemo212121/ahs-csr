import type { RtcCall, RtcCallStatus } from '@/lib/calls/types';

type RawCallRow = Record<string, any>;

export function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function nullableText(value: unknown) {
  const clean = text(value);
  return clean || null;
}

function getRequestNumber(row: RawCallRow) {
  const request = row.request;
  if (!request) return null;
  if (Array.isArray(request)) return nullableText(request[0]?.request_number);
  return nullableText(request.request_number);
}

// Shared by every route that returns an rtc_calls row (list, accept/end/etc)
// so the shape the client sees is always identical — a raw/partial row from
// one endpoint and a fully-mapped one from another was enough of a mismatch
// to make WebRtcCallRoom think a genuinely new call session had started.
export function mapCallRow(row: RawCallRow): RtcCall {
  return {
    id: String(row.id),
    request_id: nullableText(row.request_id),
    request_number: getRequestNumber(row),
    customer_id: nullableText(row.customer_id),
    customer_name: text(row.customer_name) || 'Customer',
    customer_email: nullableText(row.customer_email),
    phone_number: nullableText(row.phone_number),
    notes: nullableText(row.notes),
    call_reason: nullableText(row.call_reason),
    branch: nullableText(row.branch),
    city: nullableText(row.city),
    state: nullableText(row.state),
    zip_code: nullableText(row.zip_code),
    status: (row.status || 'manager_queue') as RtcCallStatus,
    queued_at: row.queued_at,
    accepted_at: row.accepted_at ?? null,
    call_started_at: row.call_started_at ?? null,
    call_ended_at: row.call_ended_at ?? null,
    call_duration_seconds: typeof row.call_duration_seconds === 'number' ? row.call_duration_seconds : null,
    accepted_by_profile_id: nullableText(row.accepted_by_profile_id),
    accepted_by_name: nullableText(row.accepted_by_name),
    accepted_by_role: nullableText(row.accepted_by_role),
    staff_joined_at: row.staff_joined_at ?? null,
    customer_joined_at: row.customer_joined_at ?? null,
    last_staff_seen_at: row.last_staff_seen_at ?? null,
    last_customer_seen_at: row.last_customer_seen_at ?? null,
    ended_by_profile_id: nullableText(row.ended_by_profile_id),
    ended_reason: nullableText(row.ended_reason),
    recording_path: nullableText(row.recording_path),
    recording_mime: nullableText(row.recording_mime),
    recording_uploaded_at: row.recording_uploaded_at ?? null,
    created_at: row.created_at,
  };
}
