export type AppRole = 'customer' | 'csr' | 'team_leader' | 'csr_manager' | 'admin';

export const roleHome: Record<AppRole, string> = {
  customer: '/customer/dashboard',
  csr: '/csr/dashboard',
  team_leader: '/team-leader/dashboard',
  csr_manager: '/manager/dashboard',
  admin: '/admin/dashboard',
};

export type AppProfile = {
  id: string;
  firebase_uid: string | null;
  supabase_user_id: string | null;
  company_id?: string | null;
  role: AppRole;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  address?: string | null;
  region?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  is_active: boolean;
  created_at?: string | null;
  branch_access?: string | null;
  preferences?: { filterRegions?: string[] } | null;
  last_seen_at?: string | null;
};

export type ErTicketViewFields = {
  company_id?: string | null;
  ticket_no?: string | null;
  customer_id?: string | null;
  location_id?: string | null;
  assigned_tech_id?: string | null;
  ticket_source?: string | null;
  warranty?: string | null;
  manufacturer?: string | null;
  account?: string | null;
  claim_company?: string | null;
  model?: string | null;
  model_version?: string | null;
  serial?: string | null;
  product_type?: string | null;
  purchase_date?: string | null;
  status?: string | null;
  part_order?: string | null;
  flow_type?: string | null;
  stage?: string | null;
  diagnosed?: boolean | null;
  customer_pref?: boolean | null;
  redo?: boolean | null;
  type?: string | null;
  schedule_date?: string | null;
  call_received_date?: string | null;
  aging?: number | null;
  calls?: number | null;
  delay?: number | null;
  internal_note?: string | null;
  fake_ticket?: boolean | null;
  original_ticket_no?: string | null;
  status_changed_at?: string | null;
  status_changed_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  location?: string | null;
  technician?: string | null;
  time_slot?: string | null;
  problem_description?: string | null;

  customer_name?: string | null;
  customer_phone?: string | null;
  customer_second_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  customer_address2?: string | null;
  customer_city?: string | null;
  customer_state?: string | null;
  customer_zip?: string | null;
  customer_address_note?: string | null;
};

export type ServiceRequest = {
  id: string;
  legacy_id?: number | null;
  customer_id?: string | null;
  company_id?: string | null;
  request_number: string;
  ticket_source?: string | null;
  source_system?: string | null;
  origin_type?: string | null;
  er_ticket_id?: string | null;
  full_name: string;
  phone_number: string;
  secondary_phone: string | null;
  customer_email: string | null;
  service_address: string;
  service_address_2: string | null;
  city: string | null;
  region: string | null;
  state: string | null;
  zip_code: string;
  landmark: string | null;
  manual_brand: string | null;
  manual_appliance_type: string | null;
  model_number: string | null;
  serial_number: string | null;
  product_model_version: string | null;
  issue_description: string | null;
  special_request: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  purchase_date: string | null;
  warranty_type: string | null;
  job_status_id?: string | null;
  brand?: { name: string | null; legacy_id?: number | null } | null;
  appliance_type?: { name: string | null; legacy_id?: number | null } | null;
  job_status?: { status_name: string | null; color_code?: string | null; legacy_id?: number | null } | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  verification_reject_reason: string | null;
  verification_notes: string | null;
  verification_reviewed_by?: string | null;
  sync_status: 'local_only' | 'pending_er_sync' | 'synced_to_er' | 'er_imported' | 'sync_failed';
  sync_error?: string | null;
  last_synced_at?: string | null;
  requested_at: string;
  updated_at: string;
  er_ticket?: ErTicketViewFields | null;

  // Staff-facing read-only handling metadata from ER ticket_audit_log.changed_by
  // with tickets.status_changed_by as a fallback for older rows.
  handled_by_current_user?: boolean;
  handled_activity_count?: number;
  handled_last_activity_at?: string | null;
  handled_last_action?: string | null;
  handled_last_field?: string | null;
  handled_last_before?: string | null;
  handled_last_after?: string | null;
  handled_source?: string | null;
};

export type DashboardStats = {
  pendingVerification: number;
  approvedTickets: number;
  rejectedTickets: number;
  activeCalls: number;
};
