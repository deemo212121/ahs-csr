-- USHS legacy customers and service requests seed converted from PHP/MySQL.
-- Run after supabase/schema.sql, supabase/admin_catalog_seed.sql, and supabase/service_areas_seed.sql.
-- Safe to re-run. This keeps the old PHP sample customers and requests visible in the TypeScript Admin pages.

create extension if not exists pgcrypto;

insert into profiles (id, supabase_user_id, role, first_name, last_name, email, phone_number, address, region, city, state, zip_code, is_active, legacy_table, legacy_id, last_login_at, created_at, updated_at) values
  ('2f74877c-bc51-5f85-a51a-3b9d46ec33b8'::uuid, '14b753d8-ee0a-5c6f-bd12-ba8b6e6b1673'::uuid, 'customer', 'Manny', 'Pacquiao', 'test@gmail.com', '1234567890', '5420 Riverdale Rd #P19
Atlanta, Georgia(GA), 30349', null, null, null, '30349', true, 'customers', 1, '2026-06-16 08:56:04'::timestamptz, '2026-03-04 18:31:28'::timestamptz, '2026-06-16 12:56:04'::timestamptz),
  ('f9492de5-2847-57db-b9d9-61c6b4200269'::uuid, 'b2398365-0591-5ffe-8229-141004fbdeff'::uuid, 'customer', 'Test', 'test', 'test1@gmail.com', '9223412834', 'Wakas', null, null, null, '30398', true, 'customers', 2, '2026-06-15 16:07:24'::timestamptz, '2026-05-06 15:58:11'::timestamptz, '2026-06-15 20:07:24'::timestamptz),
  ('256ef0dd-c647-5b7d-bb7a-0c886480af48'::uuid, '08b2d9b6-c9f6-56fd-9c54-12dc7948a34a'::uuid, 'customer', 'Bubble', 'Max', 'bubblemax@gmail.com', '9248375123', 'Chattanooga', null, null, null, '30030', true, 'customers', 3, '2026-06-17 15:01:28'::timestamptz, '2026-05-26 16:54:25'::timestamptz, '2026-06-17 19:01:28'::timestamptz),
  ('e3a5aa6f-ba4e-59d7-8f21-73a9d2dffa7b'::uuid, '8c8c8acc-2ad6-5475-a91e-4349dacf36a0'::uuid, 'customer', 'Angelo', 'Mendoza', 'angelo.mendozawork23@gmail.com', '8000000000', 'Palasan', 'Atlanta', 'Decatur', 'Georgia', '30030', true, 'customers', 4, null, '2026-06-15 15:21:48'::timestamptz, '2026-06-15 15:21:48'::timestamptz),
  ('9683965c-dd65-5a59-9bd5-141517e2bde9'::uuid, 'b3adde32-1c92-5583-8ba5-fa2414b430e1'::uuid, 'customer', 'Customer', 'NumberOne', 'customerone@gmail.com', '8081208301', 'Cape Girardeau', 'Cape Girardeau', null, 'Arkansas', '72464', true, 'customers', 5, null, '2026-06-16 13:35:29'::timestamptz, '2026-06-16 13:35:29'::timestamptz)
on conflict (email) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  phone_number = excluded.phone_number,
  address = excluded.address,
  region = excluded.region,
  city = coalesce(excluded.city, profiles.city),
  state = excluded.state,
  zip_code = excluded.zip_code,
  is_active = excluded.is_active,
  legacy_table = excluded.legacy_table,
  legacy_id = excluded.legacy_id,
  last_login_at = excluded.last_login_at,
  updated_at = excluded.updated_at;

insert into service_requests (id, legacy_id, customer_id, request_number, ticket_source, source_system, origin_type, er_ticket_id, sync_status, sync_error, last_synced_at, manual_ticket_number, brand_id, manual_brand, appliance_type_id, manual_appliance_type, model_number, serial_number, product_model_version, full_name, phone_number, secondary_phone, customer_email, service_address, service_address_2, region, city, state, zip_code, landmark, urgency_level, job_status_id, issue_description, special_request, purchase_date, warranty_type, call_received_date, is_fake_ticket, preferred_date, preferred_time, preferred_time_slot, is_serviceable, validation_message, requested_at, scheduled_date, completed_date, follow_up_reminder, follow_up_due_at, in_progress_started_at, updated_at, verification_status, verification_reviewed_at, verification_reject_reason, verification_notes) values
  ('37c92b6e-2a4b-55a9-a076-91850669ed7d'::uuid, 1, (select id from profiles where legacy_table = 'customers' and legacy_id = 1 limit 1), 'SRV-20260309-7295', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, (select id from brands where legacy_id = 14 limit 1), null, (select id from appliance_types where legacy_id = 16 limit 1), null, 'RF12345', 'X3Z123', null, 'John Louis Uru', '09754164351', null, null, 'Line 1 Test Address', 'Line 2 Test Address', null, null, null, '30321', 'Near Mall', 'Emergency', (select id from job_statuses where legacy_id = 5 limit 1), 'Suddenly, it''s not working.', 'This is Special Request.', null, null, null, false, '2026-03-10'::date, '14:00:00'::time, null, true, null, '2026-03-09 18:19:34'::timestamptz, null, null, null, null, null, '2026-03-09 14:19:34'::timestamptz, 'approved', null, null, null),
  ('5dd42744-371d-5510-b08a-aacb25ef663d'::uuid, 2, (select id from profiles where legacy_table = 'customers' and legacy_id = 1 limit 1), 'SRV-20260309-7474', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, null, 'Hanabishi', null, 'Electric Stove', 'RF12345', 'X3Z123', null, 'Pinky Lacson', '09754164351', null, null, 'Line 1 Address Test', 'Line 2 Address Test', null, null, null, '30321', 'Near Mall', 'Urgent', (select id from job_statuses where legacy_id = 4 limit 1), 'It suddenly not working.', 'Don''t call. just message me.', null, null, null, false, '2026-03-10'::date, '16:00:00'::time, null, true, null, '2026-03-09 19:39:36'::timestamptz, null, '2026-05-27'::date, null, null, null, '2026-03-09 15:39:36'::timestamptz, 'approved', null, null, null),
  ('e138f165-abe5-53b1-a233-78cf58a82e2d'::uuid, 3, null, 'SRV-20260311-3609', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, (select id from brands where legacy_id = 14 limit 1), null, (select id from appliance_types where legacy_id = 1 limit 1), null, 'RF12345', 'X3Z123', null, 'John Louis Uru', '09754164351', null, null, 'Test Line 1 Address', 'Test Line 2 Address', null, null, null, '30030', null, 'Urgent', (select id from job_statuses where legacy_id = 4 limit 1), 'Suddenly it doesn''t get cold anymore.', 'Just leave a message, do not call.', null, null, null, false, '2026-03-13'::date, '09:00:00'::time, null, true, null, '2026-03-11 18:22:03'::timestamptz, null, '2026-05-27'::date, null, null, null, '2026-03-11 14:22:03'::timestamptz, 'approved', null, null, null),
  ('66f4de8d-5f27-57a3-bcca-b23e65305092'::uuid, 4, (select id from profiles where legacy_table = 'customers' and legacy_id = 1 limit 1), 'SRV-20260311-4918', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, null, 'Hanabishi', (select id from appliance_types where legacy_id = 1 limit 1), null, 'RF12345', 'X3Z123', null, 'John Louis Uru', '09754164351', null, null, 'Line 1 Address Test', 'Line 2 Address Test', null, null, null, '30030', null, 'Urgent', (select id from job_statuses where legacy_id = 4 limit 1), 'Suddenly it doesn''t get cold.', 'Test Special Request', null, null, null, false, '2026-03-13'::date, '11:00:00'::time, null, true, null, '2026-03-11 18:23:40'::timestamptz, null, '2026-05-07'::date, null, null, null, '2026-03-11 14:23:40'::timestamptz, 'approved', null, null, null),
  ('f2f2a41a-34ca-578a-9224-238c1b13f260'::uuid, 5, (select id from profiles where legacy_table = 'customers' and legacy_id = 1 limit 1), 'SRV-20260317-8066', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, (select id from brands where legacy_id = 1 limit 1), null, (select id from appliance_types where legacy_id = 7 limit 1), null, '12345B', '12345A', null, 'John Cena', '123456789', null, null, 'Test Address Line 1', 'Line 2 Address Test', null, null, null, '30307', null, 'Emergency', (select id from job_statuses where legacy_id = 4 limit 1), 'Suddenly It does not work.', 'Just drop a message, do not call.', null, null, null, false, '2026-03-18'::date, '13:00:00'::time, null, true, null, '2026-03-17 17:33:23'::timestamptz, null, '2026-03-17'::date, null, null, null, '2026-03-17 13:33:23'::timestamptz, 'approved', null, null, null),
  ('0c15801a-41cc-5306-8eaf-8a2d15524747'::uuid, 6, (select id from profiles where legacy_table = 'customers' and legacy_id = 1 limit 1), 'SRV-20260402-9027', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, null, 'Panasonic', null, 'Electric Stove', 'RF12345', 'X3Z123', null, 'James Raid', '3026548276', null, null, '630 Homestead Rd', 'Wilmington Delaware (DE), 19805', null, null, null, '19805', null, 'Urgent', (select id from job_statuses where legacy_id = 4 limit 1), 'Testttt', 'Test Request', null, null, null, false, '2026-04-04'::date, '14:00:00'::time, null, true, null, '2026-04-02 13:14:25'::timestamptz, null, '2026-05-30'::date, null, null, null, '2026-04-02 09:14:25'::timestamptz, 'approved', null, null, null),
  ('ab43d7c1-7fc2-5285-b5b3-0b2dddebdd41'::uuid, 7, (select id from profiles where legacy_table = 'customers' and legacy_id = 1 limit 1), 'SRV-20260409-6426', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, (select id from brands where legacy_id = 14 limit 1), null, (select id from appliance_types where legacy_id = 1 limit 1), null, 'RF12345', 'X3Z123', null, 'John Doe', '3026548276', null, null, 'Test Address Line 1', 'Test Line 2', null, null, null, '19805', null, 'Urgent', (select id from job_statuses where legacy_id = 4 limit 1), 'It suddenly not cooling', 'Don''t make a call, just message me.', null, null, null, false, '2026-04-11'::date, '10:00:00'::time, null, true, null, '2026-04-09 15:14:36'::timestamptz, null, '2026-05-30'::date, null, null, null, '2026-04-09 11:14:36'::timestamptz, 'approved', null, null, null),
  ('db81d47e-1e88-5768-8354-b0d233a5d7a0'::uuid, 8, (select id from profiles where legacy_table = 'customers' and legacy_id = 1 limit 1), 'SRV-20260422-4522', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, null, 'Yamaha', null, 'Split Type Airconditioner', '321ABC', 'ABC123', null, 'Bieber Justin', '123456789', null, null, 'Test Address 1', 'Test Address Line 2', null, null, null, '61912', null, 'Emergency', (select id from job_statuses where legacy_id = 4 limit 1), 'Suddenly it does not turn on.', 'Just leave a message, do not call.', null, null, null, false, '2026-04-23'::date, '14:00:00'::time, null, true, null, '2026-04-22 13:17:57'::timestamptz, null, '2026-05-30'::date, null, null, null, '2026-04-22 09:17:57'::timestamptz, 'approved', null, null, null),
  ('d34860e7-74e1-5638-8dc3-e39a3e45c4dc'::uuid, 9, (select id from profiles where legacy_table = 'customers' and legacy_id = 2 limit 1), 'SRV-20260506-6102', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, null, 'Apple', null, 'Apple Watch', null, null, null, 'Mitch Modelo', '942-421-9821', null, null, 'BBB', null, null, null, null, '30303', null, 'Normal', (select id from job_statuses where legacy_id = 4 limit 1), 'I need the apple watch.', 'Provide a box', null, null, null, false, '2026-05-15'::date, '09:00:00'::time, null, true, null, '2026-05-06 17:12:36'::timestamptz, null, '2026-05-27'::date, null, null, null, '2026-05-06 13:12:36'::timestamptz, 'approved', null, null, null),
  ('7ef322b5-e660-5764-b347-d666e39dcea2'::uuid, 10, (select id from profiles where legacy_table = 'customers' and legacy_id = 2 limit 1), 'SRV-20260526-4215', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, (select id from brands where legacy_id = 10 limit 1), null, (select id from appliance_types where legacy_id = 5 limit 1), null, 'OIWER1231WQDD', 'DQH11231S', null, 'Mitch Modelo', '404-294-2412', null, null, 'Test', null, null, null, null, '30320', null, 'Urgent', (select id from job_statuses where legacy_id = 4 limit 1), 'I need it right away', null, null, null, null, false, '2026-05-29'::date, '00:00:00'::time, null, true, null, '2026-05-26 18:46:33'::timestamptz, null, '2026-05-27'::date, null, null, null, '2026-05-26 14:46:33'::timestamptz, 'approved', null, null, null),
  ('331fc755-d520-5843-b273-721d3203bfba'::uuid, 11, (select id from profiles where legacy_table = 'customers' and legacy_id = 2 limit 1), 'SRV-20260529-3813', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, (select id from brands where legacy_id = 8 limit 1), null, (select id from appliance_types where legacy_id = 4 limit 1), null, 'OIWER1231WQDD', 'DA21DSA2', null, 'Mitch Modelo', '402-992-3522', null, null, 'Test address', null, null, null, null, '30320', null, 'Normal', (select id from job_statuses where legacy_id = 2 limit 1), 'Need ASAP', null, null, null, null, false, '2026-06-02'::date, '00:00:00'::time, null, true, null, '2026-05-29 19:12:21'::timestamptz, null, null, null, null, null, '2026-06-15 16:07:27'::timestamptz, 'approved', null, null, null),
  ('d2ddd125-f519-5d5f-8e3b-400bf9627dc3'::uuid, 12, (select id from profiles where legacy_table = 'customers' and legacy_id = 1 limit 1), 'SRV-20260529-4607', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, (select id from brands where legacy_id = 10 limit 1), null, (select id from appliance_types where legacy_id = 10 limit 1), null, 'W12312321', '123', null, 'Angelo', '09358753163', null, null, 'Palasan, Valenzuela City, Philippines', null, null, null, null, '30030', null, 'Emergency', (select id from job_statuses where legacy_id = 1 limit 1), 'broken', null, null, null, null, false, '2026-05-30'::date, '00:00:00'::time, null, true, null, '2026-05-29 20:17:48'::timestamptz, null, null, 'Waiting for parts', null, null, '2026-06-04 15:07:08'::timestamptz, 'approved', null, null, null),
  ('a0b17141-a0f0-5f95-9f6b-2d77860ad526'::uuid, 13, (select id from profiles where legacy_table = 'customers' and legacy_id = 3 limit 1), 'SRV-20260602-5418', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, (select id from brands where legacy_id = 12 limit 1), null, (select id from appliance_types where legacy_id = 10 limit 1), null, 'ASDQW2423ERW', 'R32ERS', null, 'Bubble Max', '404-202-200', null, null, 'Test', null, null, null, null, '30303', null, 'Normal', (select id from job_statuses where legacy_id = 1 limit 1), 'Needed ASAP', null, null, null, null, false, '2026-06-06'::date, '00:00:00'::time, null, true, null, '2026-06-02 16:29:44'::timestamptz, null, null, null, null, null, '2026-06-02 12:29:44'::timestamptz, 'approved', null, null, null),
  ('e6145e9b-f22b-5729-8a69-74a0f4bd7af3'::uuid, 14, (select id from profiles where legacy_table = 'customers' and legacy_id = 3 limit 1), 'SRV-20260602-1321', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, (select id from brands where legacy_id = 5 limit 1), null, (select id from appliance_types where legacy_id = 1 limit 1), null, 'IU123ODIQW', 'U23UI1D', null, 'Bubble Max', '404-202-200', null, null, 'Test', null, null, null, null, '30321', null, 'Urgent', (select id from job_statuses where legacy_id = 2 limit 1), 'Need ASAP', null, null, null, null, false, '2026-06-05'::date, '00:00:00'::time, null, true, null, '2026-06-02 16:37:18'::timestamptz, null, null, null, null, null, '2026-06-12 11:16:16'::timestamptz, 'approved', null, null, null),
  ('a6d12a3d-ca9f-5e40-a096-46db142af420'::uuid, 15, null, '09358753163', 'csr_manual', 'php_csr', 'Manual Ticket', null, 'local_only', null, null, '09358753163', (select id from brands where legacy_id = 20 limit 1), null, (select id from appliance_types where legacy_id = 18 limit 1), null, 'try', 'try', 'try', 'Angelo Miguel Mendoza', '09358753163', '09358753163', 'angelo.mendoza@usinhomeservices.com', 'Palasan, Valenzuela City, Philippines', 'Palasan, Valenzuela City, Philippines', null, null, null, '1444', 'Palasan, Valenzuela City, Philippines', 'Normal', (select id from job_statuses where legacy_id = 1 limit 1), '123', 'Source: Phone Call
Email: angelo.mendoza@usinhomeservices.com
Secondary Phone: 09358753163
State: AR
Address Note: Palasan, Valenzuela City, Philippines
Model Version: try
Purchase Date: 2026-06-06
Warranty Type: Manufacturer Warranty
Call Received Date: 2026-06-03
Fake Ticket: Yes - not included statistically.', '2026-06-06'::date, 'Manufacturer Warranty', '2026-06-03'::date, true, '2026-06-05'::date, '00:00:00'::time, null, true, null, '2026-06-03 13:56:04'::timestamptz, null, null, null, null, null, '2026-06-03 09:56:04'::timestamptz, 'approved', null, null, null),
  ('260c658d-7603-5ba6-adba-7de3c3026082'::uuid, 16, null, '12312321', 'csr_manual', 'php_csr', 'Manual Ticket', null, 'local_only', null, null, '12312321', (select id from brands where legacy_id = 2 limit 1), null, (select id from appliance_types where legacy_id = 17 limit 1), null, '12312321', '123213', '12321321', 'Angelo Miguel Mendoza', '09358753163', '1321321', 'angelo.mendoza@usinhomeservices.com', 'Palasan, Valenzuela City, Philippines', 'Palasan, Valenzuela City, Philippines', null, null, null, '1444', 'Palasan, Valenzuela City, Philippines', 'Urgent', (select id from job_statuses where legacy_id = 1 limit 1), '1232132131', 'Source: Website
Email: angelo.mendoza@usinhomeservices.com
Secondary Phone: 1321321
State: VA
Address Note: Palasan, Valenzuela City, Philippines
Model Version: 12321321
Purchase Date: 2026-07-10
Warranty Type: Extended Warranty
Call Received Date: 2026-06-03', '2026-07-10'::date, 'Extended Warranty', '2026-06-03'::date, false, '2026-06-22'::date, '00:00:00'::time, null, true, null, '2026-06-03 14:00:38'::timestamptz, null, null, null, null, null, '2026-06-03 10:00:38'::timestamptz, 'approved', null, null, null),
  ('9ca67c01-6ab2-50c8-8f44-4c72ab31eb89'::uuid, 17, (select id from profiles where legacy_table = 'customers' and legacy_id = 1 limit 1), 'SRV-20260608-6143', 'cx_online', 'php_cx', 'Customer App', null, 'local_only', null, null, null, (select id from brands where legacy_id = 11 limit 1), null, (select id from appliance_types where legacy_id = 10 limit 1), null, '12313213', '123123213', null, 'Angelo Mendoza', '09358753163', null, null, 'Altanta', 'Geneva', 'Atlanta', 'Decatur', 'Georgia', '30030', null, 'Emergency', (select id from job_statuses where legacy_id = 1 limit 1), 'broken', null, null, null, null, false, '2026-06-09'::date, '00:00:00'::time, null, true, null, '2026-06-08 13:33:37'::timestamptz, null, null, null, null, null, '2026-06-16 08:56:24'::timestamptz, 'approved', null, null, null),
  ('91e57048-9b0b-5c95-8a2a-6ae2847873db'::uuid, 19, (select id from profiles where legacy_table = 'customers' and legacy_id = 3 limit 1), 'CALL-20260612-3929', 'csr_manual', 'php_csr', 'Phone Call', null, 'local_only', null, null, 'CALL-20260612-3929', (select id from brands where legacy_id = 5 limit 1), null, (select id from appliance_types where legacy_id = 7 limit 1), null, 'KWE1231DSQ', 'EII1231QW', 'VERSION 2', 'Bubble Max', '9248375123', null, 'bubblemax@gmail.com', 'Chattanooga', null, 'Atlanta', 'Decatur', 'GA', '30030', null, 'Normal', (select id from job_statuses where legacy_id = 5 limit 1), 'Need to be fixed ASAP', 'Source: Phone Call
Email: bubblemax@gmail.com
State: GA
Model Version: VERSION 2
Purchase Date: 2026-05-12
Warranty Type: Home Warranty
Call Received Date: 2026-06-12', '2026-05-12'::date, 'Home Warranty', '2026-06-12'::date, false, '2026-06-12'::date, '00:00:00'::time, null, true, null, '2026-06-12 15:24:54'::timestamptz, null, null, null, null, null, '2026-06-12 11:24:54'::timestamptz, 'approved', null, null, null),
  ('5f1fa753-24ea-5a3c-bad6-2cfbe0079a2b'::uuid, 20, (select id from profiles where legacy_table = 'customers' and legacy_id = 3 limit 1), 'CALL-20260612-6418', 'csr_manual', 'php_csr', 'Phone Call', null, 'local_only', null, null, 'CALL-20260612-6418', (select id from brands where legacy_id = 5 limit 1), null, (select id from appliance_types where legacy_id = 7 limit 1), null, 'KWE1231DSQ', 'EII1231QW', 'VERSION 2', 'Bubble Max', '9248375123', '9248375123', 'bubblemax@gmail.com', 'Chattanooga', 'Chattanooga', 'Atlanta', 'Decatur', 'GA', '30030', 'Chattanooga', 'Normal', (select id from job_statuses where legacy_id = 5 limit 1), 'Need to be fixed ASAP', 'Source: Phone Call
Email: bubblemax@gmail.com
Secondary Phone: 9248375123
State: GA
Address Note: Chattanooga
Model Version: VERSION 2
Purchase Date: 2026-05-12
Warranty Type: Home Warranty
Call Received Date: 2026-06-12', '2026-05-12'::date, 'Home Warranty', '2026-06-12'::date, false, '2026-06-12'::date, '00:00:00'::time, null, true, null, '2026-06-12 15:25:36'::timestamptz, null, null, null, null, null, '2026-06-12 11:25:36'::timestamptz, 'approved', null, null, null),
  ('c78452c8-5adc-5562-ac16-1de3304709f3'::uuid, 21, (select id from profiles where legacy_table = 'customers' and legacy_id = 3 limit 1), 'CALL-20260612-9167', 'csr_manual', 'php_csr', 'Phone Call', null, 'local_only', null, null, 'CALL-20260612-9167', (select id from brands where legacy_id = 5 limit 1), null, (select id from appliance_types where legacy_id = 7 limit 1), null, 'KWE1231DSQ', 'EII1231QW', 'VERSION 2', 'Bubble Max', '9248375123', '9248375123', 'bubblemax@gmail.com', 'Chattanooga', 'Chattanooga', 'Atlanta', 'Decatur', 'GA', '30030', 'Chattanooga', 'Normal', (select id from job_statuses where legacy_id = 1 limit 1), 'Need to be fixed ASAP', 'Source: Phone Call
Email: bubblemax@gmail.com
Secondary Phone: 9248375123
State: GA
Address Note: Chattanooga
Model Version: VERSION 2
Purchase Date: 2026-05-12
Warranty Type: Home Warranty
Call Received Date: 2026-06-12', '2026-05-12'::date, 'Home Warranty', '2026-06-12'::date, false, '2026-06-12'::date, '00:00:00'::time, null, true, null, '2026-06-12 15:45:10'::timestamptz, null, null, null, null, null, '2026-06-12 11:45:10'::timestamptz, 'approved', null, null, null),
  ('15fc386e-8d6a-59e7-84d9-21daaab09a96'::uuid, 22, (select id from profiles where legacy_table = 'customers' and legacy_id = 3 limit 1), 'SRV-20260612-5515', 'cx_online', 'php_cx', 'CX Submission', null, 'local_only', null, null, null, (select id from brands where legacy_id = 8 limit 1), null, (select id from appliance_types where legacy_id = 11 limit 1), null, 'KWE12IWOE12', 'DQ21E1AD', 'Series 1', 'Bubble Max', '9248375123', null, 'bubblemax@gmail.com', 'Chattanooga', null, 'Atlanta', 'Decatur', 'Georgia', '30030', null, 'Normal', (select id from job_statuses where legacy_id = 1 limit 1), 'Need to be fixed ASAP', null, '2026-05-15'::date, 'Home Warranty', '2026-06-12'::date, false, '2026-06-14'::date, null, null, true, null, '2026-06-12 17:12:28'::timestamptz, null, null, null, null, null, '2026-06-12 14:31:55'::timestamptz, 'approved', '2026-06-12 13:14:38'::timestamptz, null, 'Request verified and approved by CSR.'),
  ('65f35aa6-b969-58e3-96b3-ff1fdfee7d9e'::uuid, 23, (select id from profiles where legacy_table = 'customers' and legacy_id = 3 limit 1), 'CALL-20260612-9337', 'csr_manual', 'php_csr', 'Web Call', null, 'local_only', null, null, 'CALL-20260612-9337', (select id from brands where legacy_id = 16 limit 1), null, (select id from appliance_types where legacy_id = 12 limit 1), null, 'HSDU2131UDA', 'EQ213DQ', 'Version 1', 'Bubble Max', '9248375123', null, 'bubblemax@gmail.com', 'Chattanooga', null, 'Atlanta', 'Decatur', 'GA', '30030', null, 'Normal', (select id from job_statuses where legacy_id = 1 limit 1), 'Customer requested a web call for request #SRV-20260612-5515', 'Source: Web Call
Email: bubblemax@gmail.com
State: GA
Model Version: Version 1
Purchase Date: 2026-04-15
Warranty Type: Home Warranty
Call Received Date: 2026-06-12', '2026-04-15'::date, 'Home Warranty', '2026-06-12'::date, false, '2026-06-15'::date, '00:00:00'::time, null, true, null, '2026-06-12 18:33:42'::timestamptz, null, null, null, null, null, '2026-06-15 12:36:06'::timestamptz, 'approved', null, null, null),
  ('655d84ab-d572-5323-bf5a-5e528a0e9286'::uuid, 24, (select id from profiles where legacy_table = 'customers' and legacy_id = 3 limit 1), 'SRV-20260615-2005', 'cx_online', 'php_cx', 'CX Submission', null, 'local_only', null, null, null, (select id from brands where legacy_id = 8 limit 1), null, (select id from appliance_types where legacy_id = 2 limit 1), null, 'JKHD123DQW', 'DWQ31D1', 'Version 2', 'Bubble Max', '9248375123', null, 'bubblemax@gmail.com', 'Chattanooga', null, 'Atlanta', 'Decatur', 'Georgia', '30030', null, 'Normal', (select id from job_statuses where legacy_id = 1 limit 1), 'Need ASAP', null, '2025-03-04'::date, 'Out of Warranty', '2026-06-15'::date, false, '2026-06-17'::date, null, null, true, null, '2026-06-15 17:52:09'::timestamptz, null, null, null, null, null, '2026-06-17 10:12:35'::timestamptz, 'approved', '2026-06-15 13:52:41'::timestamptz, null, 'Request verified and approved by CSR.'),
  ('33fb72ab-6dcc-5b85-aadf-562507fe87db'::uuid, 25, (select id from profiles where legacy_table = 'customers' and legacy_id = 5 limit 1), 'SRV-20260616-5940', 'cx_online', 'php_cx', 'CX Submission', null, 'local_only', null, null, null, (select id from brands where legacy_id = 4 limit 1), null, (select id from appliance_types where legacy_id = 17 limit 1), null, 'RF1231321312', 'GE12321312', null, 'Customer NumberOne', '8081208301', null, 'CustomerOne@gmail.com', 'Cape Girardeau', 'Red gate', 'Cape Girardeau', 'Decatur', 'Arkansas', '72464', 'Red gate', 'Normal', (select id from job_statuses where legacy_id = 1 limit 1), 'broken`', null, '2026-06-01'::date, 'Google Search', '2026-06-16'::date, false, '2026-06-17'::date, null, null, true, null, '2026-06-16 13:36:21'::timestamptz, null, null, null, null, null, '2026-06-16 09:36:21'::timestamptz, 'pending', null, null, null)
on conflict (legacy_id) do update set
  customer_id = excluded.customer_id,
  request_number = excluded.request_number,
  ticket_source = excluded.ticket_source,
  source_system = excluded.source_system,
  origin_type = excluded.origin_type,
  sync_status = excluded.sync_status,
  manual_ticket_number = excluded.manual_ticket_number,
  brand_id = excluded.brand_id,
  manual_brand = excluded.manual_brand,
  appliance_type_id = excluded.appliance_type_id,
  manual_appliance_type = excluded.manual_appliance_type,
  full_name = excluded.full_name,
  phone_number = excluded.phone_number,
  customer_email = excluded.customer_email,
  service_address = excluded.service_address,
  service_address_2 = excluded.service_address_2,
  region = excluded.region,
  city = excluded.city,
  state = excluded.state,
  zip_code = excluded.zip_code,
  urgency_level = excluded.urgency_level,
  job_status_id = excluded.job_status_id,
  issue_description = excluded.issue_description,
  preferred_date = excluded.preferred_date,
  preferred_time = excluded.preferred_time,
  is_serviceable = excluded.is_serviceable,
  requested_at = excluded.requested_at,
  completed_date = excluded.completed_date,
  updated_at = excluded.updated_at,
  verification_status = excluded.verification_status,
  verification_reviewed_at = excluded.verification_reviewed_at,
  verification_notes = excluded.verification_notes;

-- Quick verification after running:
-- select count(*) as customers from profiles where role='customer';
-- select count(*) as requests from service_requests;
-- select count(*) as zips, count(distinct region) as regions from service_areas;
