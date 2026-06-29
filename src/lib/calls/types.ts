export type RtcCallStatus =
  | 'manager_queue'
  | 'assigned'
  | 'accepted'
  | 'missed'
  | 'completed'
  | 'cancelled';

export type RtcCall = {
  id: string;
  request_id: string | null;
  request_number: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  phone_number: string | null;
  notes: string | null;
  call_reason: string | null;
  branch: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: RtcCallStatus;
  queued_at: string;
  accepted_at: string | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  call_duration_seconds: number | null;
  accepted_by_profile_id: string | null;
  accepted_by_name: string | null;
  accepted_by_role: string | null;
  staff_joined_at: string | null;
  customer_joined_at: string | null;
  last_staff_seen_at: string | null;
  last_customer_seen_at: string | null;
  ended_by_profile_id: string | null;
  ended_reason: string | null;
  recording_path: string | null;
  recording_mime: string | null;
  recording_uploaded_at: string | null;
  created_at: string;
};

export type RtcCallListResponse = {
  calls: RtcCall[];
  branches: string[];
  setup_required?: boolean;
  message?: string;
};

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type IceServersResponse = {
  iceServers: IceServerConfig[];
  provider: 'cloudflare' | 'metered' | 'static' | 'fallback';
  configured: boolean;
  message?: string;
};

export type RtcSignalType = 'ready' | 'offer' | 'answer' | 'ice-candidate' | 'hangup';

export type RtcSignal = {
  id: string;
  call_id: string;
  sender_profile_id: string;
  sender_role: 'customer' | 'staff';
  signal_type: RtcSignalType;
  payload: Record<string, unknown>;
  created_at: string;
};
