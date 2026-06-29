export type CallRequestStatus =
  | 'manager_queue'
  | 'assigned'
  | 'accepted'
  | 'missed'
  | 'completed'
  | 'cancelled';

export type BrowserCallStatus = 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed';

export type CallQueueItem = {
  id: string;
  request_id: string | null;
  request_number: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  phone_number: string;
  notes: string | null;
  call_reason: string | null;
  call_direction: 'inbound' | 'outbound';
  branch: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: CallRequestStatus;
  provider: string | null;
  room_token: string | null;
  room_name: string | null;
  call_mode: string | null;
  browser_call_status: BrowserCallStatus;
  queued_at: string;
  assigned_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  call_duration_seconds: number | null;
  recording_path: string | null;
  recording_mime: string | null;
  recording_uploaded_at: string | null;
  accepted_by_profile_id: string | null;
  accepted_by_name: string | null;
  accepted_by_role: string | null;
  staff_joined_at: string | null;
  customer_joined_at: string | null;
  last_staff_seen_at: string | null;
  last_customer_seen_at: string | null;
  ended_by_profile_id: string | null;
  ended_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type CallQueueResponse = {
  calls: CallQueueItem[];
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

export type CallSignalType = 'ready' | 'offer' | 'answer' | 'ice-candidate' | 'hangup';

export type CallSignal = {
  id: string;
  call_request_id: string;
  sender_profile_id: string;
  sender_role: 'customer' | 'staff';
  signal_type: CallSignalType;
  payload: Record<string, unknown>;
  created_at: string;
};
