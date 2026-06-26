-- USHS Admin catalog seed converted from the PHP/MySQL database dump.
-- Run after supabase/schema.sql. Safe to re-run.

-- Compatibility migration for projects that already ran an earlier starter schema.
alter table profiles add column if not exists address text;
alter table profiles add column if not exists region text;
alter table profiles add column if not exists city text;
alter table profiles add column if not exists state text;
alter table profiles add column if not exists zip_code text;

alter table brands add column if not exists updated_at timestamptz not null default now();
alter table appliance_types add column if not exists updated_at timestamptz not null default now();

drop trigger if exists brands_set_updated_at on brands;
create trigger brands_set_updated_at
before update on brands
for each row execute function set_updated_at();

drop trigger if exists appliance_types_set_updated_at on appliance_types;
create trigger appliance_types_set_updated_at
before update on appliance_types
for each row execute function set_updated_at();

create table if not exists request_logs (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  legacy_request_id integer,
  user_id integer,
  user_role text,
  actor_name text,
  actor_email text,
  actor_role_label text,
  action text not null,
  old_value text,
  new_value text,
  notes text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists request_logs_created_at_idx on request_logs(created_at desc);
create index if not exists request_logs_action_idx on request_logs(action);

insert into brands (legacy_id, name, logo_url, created_at) values
  (1, 'Samsung', null, '2026-03-03 08:41:03'),
  (2, 'LG', null, '2026-03-03 08:41:03'),
  (3, 'Whirlpool', null, '2026-03-03 08:41:03'),
  (4, 'GE', null, '2026-03-03 08:41:03'),
  (5, 'Frigidaire', null, '2026-03-03 08:41:03'),
  (6, 'KitchenAid', null, '2026-03-03 08:41:03'),
  (7, 'Maytag', null, '2026-03-03 08:41:03'),
  (8, 'Bosch', null, '2026-03-03 08:41:03'),
  (10, 'Amana', null, '2026-03-09 14:37:09'),
  (11, 'Avanti', null, '2026-03-09 14:37:09'),
  (12, 'Cafe', null, '2026-03-09 14:37:09'),
  (13, 'Dacor', null, '2026-03-09 14:37:09'),
  (14, 'Electrolux', null, '2026-03-09 14:37:09'),
  (16, 'Haier', null, '2026-03-09 14:37:09'),
  (17, 'Hisense', null, '2026-03-09 14:37:09'),
  (18, 'Kenmore', null, '2026-03-09 14:37:09'),
  (20, 'Midea', null, '2026-03-09 14:37:09'),
  (21, 'Miele', null, '2026-03-09 14:37:09'),
  (22, 'Monogram', null, '2026-03-09 14:37:09'),
  (23, 'Speed Queen', null, '2026-03-09 14:37:09'),
  (24, 'Zline', null, '2026-03-09 14:37:09')
on conflict (name) do update set legacy_id = excluded.legacy_id, logo_url = excluded.logo_url;

insert into appliance_types (legacy_id, name, icon_class, sort_order, created_at) values
  (1, 'Refrigerator', 'fas fa-tools', 1, '2026-03-03 08:41:03'),
  (2, 'Washer', 'fas fa-tools', 2, '2026-03-03 08:41:03'),
  (3, 'Dryer', 'fas fa-tools', 3, '2026-03-03 08:41:03'),
  (4, 'Dishwasher', 'fas fa-tools', 4, '2026-03-03 08:41:03'),
  (5, 'Oven', 'fas fa-tools', 5, '2026-03-03 08:41:03'),
  (6, 'Microwave', 'fas fa-tools', 6, '2026-03-03 08:41:03'),
  (7, 'Freezer', 'fas fa-tools', 7, '2026-03-03 08:41:03'),
  (8, 'Air Conditioner', 'fas fa-tools', 8, '2026-03-03 08:41:03'),
  (10, 'Coffee Maker', 'fas fa-tools', 0, '2026-03-09 14:41:06'),
  (11, 'Cooktop', 'fas fa-tools', 0, '2026-03-09 14:41:06'),
  (12, 'Ice Maker', 'fas fa-tools', 0, '2026-03-09 14:41:06'),
  (13, 'Range', 'fas fa-tools', 0, '2026-03-09 14:41:06'),
  (14, 'Range Hood', 'fas fa-tools', 0, '2026-03-09 14:41:06'),
  (15, 'TV', 'fas fa-tools', 0, '2026-03-09 14:41:06'),
  (16, 'Wall Oven', 'fas fa-tools', 0, '2026-03-09 14:41:06'),
  (17, 'Wine Cooler', 'fas fa-tools', 0, '2026-03-09 14:41:06'),
  (18, 'Washer/Dryer Combo', 'fas fa-tools', 0, '2026-03-09 14:42:41')
on conflict (name) do update set legacy_id = excluded.legacy_id, icon_class = excluded.icon_class, sort_order = excluded.sort_order;

insert into request_logs (legacy_id, legacy_request_id, user_id, user_role, actor_name, actor_email, actor_role_label, action, old_value, new_value, notes, ip_address, created_at) values
  (1, 10, 2, 'csr', null, null, null, 'status_change', '3', '4', '', '::1', '2026-05-27 14:58:47'),
  (2, 7, 2, 'csr', null, null, null, 'status_change', '2', '3', '', '::1', '2026-05-27 15:00:55'),
  (3, 7, 2, 'csr', null, null, null, 'status_change', '3', '2', '', '::1', '2026-05-27 15:02:43'),
  (4, 7, 2, 'csr', null, null, null, 'status_change', '2', '3', '', '::1', '2026-05-27 15:04:56'),
  (5, 7, 2, 'csr', null, null, null, 'status_change', '3', '2', '', '::1', '2026-05-27 15:14:00'),
  (6, 7, 2, 'csr', null, null, null, 'status_change', '2', '3', '', '::1', '2026-05-27 15:17:24'),
  (7, 5, 1, 'csr', null, null, null, 'request_claimed', null, 'Admin CSR', 'CSR clicked Manage', '::1', '2026-05-29 18:18:07'),
  (8, 6, 1, 'csr', null, null, null, 'status_change', '1', '4', '', '::1', '2026-05-29 18:18:38'),
  (9, 8, 1, 'csr', null, null, null, 'status_change', '1', '4', '', '::1', '2026-05-29 18:30:14'),
  (10, 1, 1, 'csr', null, null, null, 'request_claimed', null, 'Admin CSR', 'CSR clicked Manage', '::1', '2026-05-29 18:37:14'),
  (11, 7, 2, 'csr', null, null, null, 'status_change', '3', '2', '', '::1', '2026-05-29 18:37:54'),
  (12, 7, 2, 'csr', null, null, null, 'status_change', '2', '4', '', '::1', '2026-05-29 18:38:58'),
  (13, 4, 1, 'csr', null, null, null, 'request_claimed', null, 'Admin CSR', 'CSR clicked Manage', '::1', '2026-05-29 18:39:16'),
  (14, 11, 1, 'csr', null, null, null, 'request_claimed', null, 'Admin CSR', 'CSR clicked Manage', '::1', '2026-05-29 19:13:28'),
  (15, 12, 2, 'csr', null, null, null, 'request_claimed', null, 'Deemo Mendoza', 'CSR clicked Manage', '::1', '2026-06-01 13:42:48'),
  (16, 15, null, 'csr', 'Csr', null, 'Csr', 'manual_ticket_created', null, '09358753163', 'Source: Phone Call
Email: angelo.mendoza@usinhomeservices.com
Secondary Phone: 09358753163
State: AR
Address Note: Palasan, Valenzuela City, Philippines
Model Version: try
Purchase Date: 2026-06-06
Warranty Type: Manufacturer Warranty
Call Received Date: 2026-06-03
Fake Ticket: Yes - not included statistically.', '::1', '2026-06-03 13:56:04'),
  (17, 16, 2, 'csr', 'Deemo Mendoza', 'csr2@gmail.com', 'CSR', 'manual_ticket_created', null, '12312321', 'Source: Website
Email: angelo.mendoza@usinhomeservices.com
Secondary Phone: 1321321
State: VA
Address Note: Palasan, Valenzuela City, Philippines
Model Version: 12321321
Purchase Date: 2026-07-10
Warranty Type: Extended Warranty
Call Received Date: 2026-06-03', '::1', '2026-06-03 14:00:38'),
  (18, 12, 2, 'csr', 'Deemo Mendoza', 'csr2@gmail.com', 'CSR', 'note_added', null, 'customer', 'Follow-Up: Follow up technician
Sending a follow up on technician', '136.158.61.56', '2026-06-04 18:42:07'),
  (19, 12, 2, 'csr', 'Deemo Mendoza', 'csr2@gmail.com', 'CSR', 'note_added', null, 'customer', 'Follow-Up: Waiting for parts
Still waiting for parts', '136.158.61.56', '2026-06-04 19:07:08'),
  (20, 12, 2, 'csr', 'Deemo Mendoza', 'csr2@gmail.com', 'CSR', 'customer_notified', null, 'in_app_notification', 'Customer notification sent from Customer Updates note.', '136.158.61.56', '2026-06-04 19:07:08'),
  (21, 11, 1, 'csr', 'Admin CSR', 'csr@example.com', 'CSR', 'status_change', '1', '2', '', '131.226.102.91', '2026-06-08 14:48:54'),
  (22, 17, 6, 'csr', 'Angelo Mendoza', 'angelo.mendozawork23@gmail.com', 'Team Leader', 'request_claimed', null, 'Angelo Mendoza', 'CSR clicked Manage', '131.226.102.91', '2026-06-08 18:20:57'),
  (23, 18, 1, 'csr', 'Admin CSR', 'csr@example.com', 'CSR', 'manual_ticket_created', null, 'CALL-20260609-7362', 'Source: Phone Call
Email: 123@gmail.com
State: VA
Address Note: asd
Model Version: 123
Purchase Date: 2026-06-09
Warranty Type: Extended Warranty
Call Received Date: 2026-06-04', '131.226.102.91', '2026-06-09 14:59:03'),
  (24, 18, 1, 'csr', 'Admin CSR', 'csr@example.com', 'CSR', 'status_change', '1', '2', '', '131.226.102.91', '2026-06-09 14:59:29'),
  (25, 18, 1, 'csr', 'Admin CSR', 'csr@example.com', 'CSR', 'status_change', '2', '3', '', '131.226.102.91', '2026-06-09 14:59:41'),
  (26, 18, 1, 'csr', 'Admin CSR', 'csr@example.com', 'CSR', 'status_change', '3', '4', '', '131.226.102.91', '2026-06-10 16:36:01'),
  (27, 21, 2, 'csr', 'Deemo Mendoza', 'csr2@gmail.com', 'CSR', 'manual_ticket_created', null, 'CALL-20260612-9167', 'Source: Phone Call
Email: bubblemax@gmail.com
Secondary Phone: 9248375123
State: GA
Address Note: Chattanooga
Model Version: VERSION 2
Purchase Date: 2026-05-12
Warranty Type: Home Warranty
Call Received Date: 2026-06-12', '136.158.61.240', '2026-06-12 15:45:10'),
  (28, 23, 2, 'csr', 'Deemo Mendoza', 'csr2@gmail.com', 'CSR', 'manual_ticket_created', null, 'CALL-20260612-9337', 'Source: Web Call
Email: bubblemax@gmail.com
State: GA
Model Version: Version 1
Purchase Date: 2026-04-15
Warranty Type: Home Warranty
Call Received Date: 2026-06-12', '136.158.61.240', '2026-06-12 18:33:43')
on conflict (legacy_id) do update set
  legacy_request_id = excluded.legacy_request_id,
  user_id = excluded.user_id,
  user_role = excluded.user_role,
  actor_name = excluded.actor_name,
  actor_email = excluded.actor_email,
  actor_role_label = excluded.actor_role_label,
  action = excluded.action,
  old_value = excluded.old_value,
  new_value = excluded.new_value,
  notes = excluded.notes,
  ip_address = excluded.ip_address,
  created_at = excluded.created_at;
