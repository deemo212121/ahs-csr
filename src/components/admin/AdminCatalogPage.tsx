'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  Eraser,
  Eye,
  ListChecks,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Tags,
  Trash2,
  UserCheck,
  UserRoundX,
  Users,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';

type Mode = 'customers' | 'brands' | 'appliances' | 'activity-logs';

type BrandRow = {
  id: string;
  legacy_id: number | null;
  name: string;
  logo_url: string | null;
  created_at: string;
  updated_at?: string | null;
  request_count: number;
  is_used: boolean;
};

type ApplianceRow = {
  id: string;
  legacy_id: number | null;
  name: string;
  icon_class: string | null;
  sort_order: number;
  created_at: string;
  updated_at?: string | null;
  request_count: number;
  is_used: boolean;
};

type CustomerRow = {
  id: string;
  legacy_id: number | null;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  address: string | null;
  region: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  is_active: boolean;
  request_count: number;
  created_at: string;
  updated_at?: string | null;
};

export type ActivityLogRow = {
  id: string;
  legacy_id: number | null;
  legacy_request_id: number | null;
  ticket_id?: string | null;
  ticket_no?: string | null;
  ticket_status?: string | null;
  ticket_location?: string | null;
  ticket_product?: string | null;
  ticket_brand?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  user_id: number | null;
  user_role: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role_label: string | null;
  action: string;
  action_label: string;
  field?: string | null;
  old_value: string | null;
  new_value: string | null;
  old_value_label: string | null;
  new_value_label: string | null;
  notes: string | null;
  ip_address: string | null;
  summary: string;
  created_at: string;
};

type CatalogResponse = {
  brands?: BrandRow[];
  appliances?: ApplianceRow[];
  activity_logs?: ActivityLogRow[];
  customers?: CustomerRow[];
};

const formatDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

const formatDateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function readableDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDate.format(date);
}

function readableDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDateTime.format(date);
}

function dayLine(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value, time: '' };
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function useAdminCatalog(type: 'brands' | 'appliances' | 'activity-logs' | 'customers') {
  const { user } = useAuth();
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [appliances, setAppliances] = useState<ApplianceRow[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchJsonWithFirebase<CatalogResponse>(user, `/api/admin/catalogs?type=${type}`);
      setBrands(data.brands ?? []);
      setAppliances(data.appliances ?? []);
      setActivityLogs(data.activity_logs ?? []);
      setCustomers(data.customers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [type, user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { brands, appliances, activityLogs, customers, loading, error, refresh: load, user };
}

async function sendAdminCatalog<T>(
  user: NonNullable<ReturnType<typeof useAuth>['user']>,
  type: 'brands' | 'appliances',
  init: RequestInit,
  id?: string,
) {
  const idParam = id ? `&id=${encodeURIComponent(id)}` : '';
  return fetchJsonWithFirebase<T>(user, `/api/admin/catalogs?type=${type}${idParam}`, init);
}

function AdminPageHero({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="admin-php-hero">
      <div className="admin-php-hero-title">
        <span>{icon}</span>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="admin-php-hero-actions">{children}</div>
    </section>
  );
}

function AdminCounterCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="admin-php-counter">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {icon ? <b>{icon}</b> : null}
    </div>
  );
}

function AdminTablePanel({ title, count, children }: { title: string; count?: string; children: React.ReactNode }) {
  return (
    <section className="admin-php-table-panel">
      <div className="admin-php-panel-head">
        <h2>{title}</h2>
        {count ? <span>{count}</span> : null}
      </div>
      <div className="admin-php-table-wrap">{children}</div>
    </section>
  );
}

function BrandsPage() {
  const { brands, loading, error, refresh, user } = useAdminCatalog('brands');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const totalRequests = brands.reduce((sum, brand) => sum + brand.request_count, 0);
  const used = brands.filter((brand) => brand.request_count > 0).length;
  const unused = Math.max(brands.length - used, 0);

  async function addBrand(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setNotice(null);

    try {
      await sendAdminCatalog(user, 'brands', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setName('');
      setNotice('Brand added successfully!');
      await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to add brand.');
    } finally {
      setSaving(false);
    }
  }

  async function updateBrand(brand: BrandRow, nextName: string) {
    if (!user || !nextName.trim() || nextName.trim() === brand.name) return;
    await sendAdminCatalog(user, 'brands', {
      method: 'PATCH',
      body: JSON.stringify({ name: nextName.trim() }),
    }, brand.id);
    await refresh();
  }

  async function deleteBrand(brand: BrandRow) {
    if (!user) return;
    if (!window.confirm(`Delete ${brand.name}?`)) return;
    await sendAdminCatalog(user, 'brands', { method: 'DELETE' }, brand.id);
    await refresh();
  }

  return (
    <div className="admin-php-page">
      <AdminPageHero
        icon={<Tags size={34} />}
        title="Manage Brands"
        subtitle="Add, edit, and manage serviceable appliance brands."
      >
        <span className="admin-date-pill"><CalendarDays size={13} /> Jun 18, 2026</span>
      </AdminPageHero>

      <div className="admin-php-count-grid">
        <AdminCounterCard icon={<Tags size={18} />} label="Total Brands" value={brands.length} />
        <AdminCounterCard icon={<BadgeCheck size={18} />} label="Used Brands" value={used} />
        <AdminCounterCard icon={<Eraser size={18} />} label="Unused Brands" value={unused} />
        <AdminCounterCard icon={<ClipboardList size={18} />} label="Total Requests" value={totalRequests} />
      </div>

      <section className="admin-php-form-panel">
        <div className="admin-php-panel-head"><h2>Add New Brand</h2></div>
        <form className="admin-php-inline-form" onSubmit={addBrand}>
          <label>
            Brand Name
            <input onChange={(event) => setName(event.target.value)} placeholder="Enter brand name" required value={name} />
          </label>
          <button disabled={saving} type="submit"><Plus size={17} /> {saving ? 'Adding...' : 'Add Brand'}</button>
        </form>
        {notice ? <p className="admin-php-notice">{notice}</p> : null}
      </section>

      <AdminTablePanel count={`${brands.length} records`} title="Brand List">
        {loading ? <div className="admin-empty-state">Loading brands...</div> : null}
        {error ? <div className="login-alert">{error}</div> : null}
        {!loading && !error ? (
          <table className="admin-php-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Brand Name</th>
                <th>Requests</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <tr key={brand.id}>
                  <td><span className="admin-id-pill">#{brand.legacy_id ?? 'NEW'}</span></td>
                  <td>
                    <div className="admin-edit-name">
                      <span>{initials(brand.name)}</span>
                      <input
                        defaultValue={brand.name}
                        onBlur={(event) => void updateBrand(brand, event.currentTarget.value)}
                      />
                    </div>
                  </td>
                  <td><span className="admin-count-pill">{brand.request_count}</span></td>
                  <td>{readableDate(brand.created_at)}</td>
                  <td>
                    <div className="admin-row-actions">
                      <button title="Save by editing field and leaving it" type="button"><Save size={13} /></button>
                      <button disabled={brand.request_count > 0} onClick={() => void deleteBrand(brand)} title="Delete" type="button"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </AdminTablePanel>
    </div>
  );
}

function AppliancesPage() {
  const { appliances, loading, error, refresh, user } = useAdminCatalog('appliances');
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const totalRequests = appliances.reduce((sum, appliance) => sum + appliance.request_count, 0);
  const used = appliances.filter((appliance) => appliance.request_count > 0).length;
  const unused = Math.max(appliances.length - used, 0);

  async function addAppliance(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setNotice(null);

    try {
      await sendAdminCatalog(user, 'appliances', {
        method: 'POST',
        body: JSON.stringify({ name, sort_order: sortOrder }),
      });
      setName('');
      setSortOrder(0);
      setNotice('Appliance added successfully!');
      await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to add appliance.');
    } finally {
      setSaving(false);
    }
  }

  async function updateAppliance(appliance: ApplianceRow, nextName: string, nextSortOrder: number) {
    if (!user || !nextName.trim()) return;
    if (nextName.trim() === appliance.name && nextSortOrder === appliance.sort_order) return;
    await sendAdminCatalog(user, 'appliances', {
      method: 'PATCH',
      body: JSON.stringify({ name: nextName.trim(), sort_order: nextSortOrder }),
    }, appliance.id);
    await refresh();
  }

  async function deleteAppliance(appliance: ApplianceRow) {
    if (!user) return;
    if (!window.confirm(`Delete ${appliance.name}?`)) return;
    await sendAdminCatalog(user, 'appliances', { method: 'DELETE' }, appliance.id);
    await refresh();
  }

  return (
    <div className="admin-php-page">
      <AdminPageHero
        icon={<Wrench size={34} />}
        title="Manage Appliances"
        subtitle="Add, edit, and manage appliance types shown in service requests."
      >
        <span className="admin-date-pill"><CalendarDays size={13} /> Jun 18, 2026</span>
      </AdminPageHero>

      <div className="admin-php-count-grid">
        <AdminCounterCard icon={<Wrench size={18} />} label="Total Appliances" value={appliances.length} />
        <AdminCounterCard icon={<BadgeCheck size={18} />} label="Used Types" value={used} />
        <AdminCounterCard icon={<Eraser size={18} />} label="Unused Types" value={unused} />
        <AdminCounterCard icon={<ClipboardList size={18} />} label="Total Requests" value={totalRequests} />
      </div>

      <section className="admin-php-form-panel">
        <div className="admin-php-panel-head"><h2>Add New Appliance</h2></div>
        <form className="admin-php-inline-form appliance" onSubmit={addAppliance}>
          <label>
            Appliance Name
            <input onChange={(event) => setName(event.target.value)} placeholder="Enter appliance name" required value={name} />
          </label>
          <label>
            Sort Order
            <input onChange={(event) => setSortOrder(Number(event.target.value) || 0)} type="number" value={sortOrder} />
          </label>
          <button disabled={saving} type="submit"><Plus size={17} /> {saving ? 'Adding...' : 'Add'}</button>
        </form>
        {notice ? <p className="admin-php-notice">{notice}</p> : null}
      </section>

      <AdminTablePanel count={`${appliances.length} records`} title="Appliance List">
        {loading ? <div className="admin-empty-state">Loading appliances...</div> : null}
        {error ? <div className="login-alert">{error}</div> : null}
        {!loading && !error ? (
          <table className="admin-php-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Appliance Name</th>
                <th>Sort Order</th>
                <th>Requests</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appliances.map((appliance) => {
                let draftName = appliance.name;
                let draftSort = appliance.sort_order;
                return (
                  <tr key={appliance.id}>
                    <td><span className="admin-id-pill">#{appliance.legacy_id ?? 'NEW'}</span></td>
                    <td>
                      <input
                        className="admin-table-input"
                        defaultValue={appliance.name}
                        onChange={(event) => { draftName = event.currentTarget.value; }}
                        onBlur={() => void updateAppliance(appliance, draftName, draftSort)}
                      />
                    </td>
                    <td>
                      <input
                        className="admin-table-input small"
                        defaultValue={appliance.sort_order}
                        onChange={(event) => { draftSort = Number(event.currentTarget.value) || 0; }}
                        onBlur={() => void updateAppliance(appliance, draftName, draftSort)}
                        type="number"
                      />
                    </td>
                    <td><span className="admin-count-pill">{appliance.request_count}</span></td>
                    <td>{readableDate(appliance.created_at)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button title="Save by editing field and leaving it" type="button"><Save size={13} /></button>
                        <button disabled={appliance.request_count > 0} onClick={() => void deleteAppliance(appliance)} title="Delete" type="button"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </AdminTablePanel>
    </div>
  );
}

function ActivityLogsPage() {
  const { activityLogs, loading, error, refresh } = useAdminCatalog('activity-logs');
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<ActivityLogRow | null>(null);
  const actionOptions = useMemo(() => ['all', ...Array.from(new Set(activityLogs.map((log) => log.action)))], [activityLogs]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return activityLogs.filter((log) => {
      const matchesAction = actionFilter === 'all' || log.action === actionFilter;
      if (!matchesAction) return false;
      if (!needle) return true;
      return [
        log.actor_name,
        log.actor_email,
        log.actor_role_label,
        log.action_label,
        log.old_value_label,
        log.new_value_label,
        log.notes,
        log.summary,
        log.legacy_request_id ? `#${log.legacy_request_id}` : '',
        log.new_value,
        log.old_value,
        log.ticket_no,
        log.ticket_id,
        log.ticket_status,
        log.ticket_location,
        log.ticket_product,
        log.ticket_brand,
        log.customer_name,
        log.customer_phone,
        log.field,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [activityLogs, actionFilter, query]);
  const today = activityLogs.filter((log) => new Date(log.created_at).toDateString() === new Date().toDateString()).length;
  const statusChanges = activityLogs.filter((log) => log.action === 'status_change').length;
  const ticketsTouched = new Set(activityLogs.map((log) => log.ticket_id || log.ticket_no || log.legacy_request_id).filter(Boolean)).size;

  return (
    <div className="admin-php-page activity">
      <AdminPageHero
        icon={<ListChecks size={28} />}
        title="Activity Logs"
        subtitle="Simple view for who changed what, when, and from what value to what value."
      >
        <button className="admin-outline-button" onClick={() => void refresh()} type="button"><RefreshCw size={15} /> Refresh</button>
      </AdminPageHero>

      <div className="admin-php-count-grid four">
        <AdminCounterCard label="Total Logs Shown" value={filtered.length} />
        <AdminCounterCard label="Logs Today" value={today} />
        <AdminCounterCard label="Status Changes" value={statusChanges} />
        <AdminCounterCard label="Tickets Touched" value={ticketsTouched} />
      </div>

      <div className="admin-easy-note">
        Easy mode: read the sentence first. Click the activity title to view full ticket change details from the ER audit log.
      </div>

      <section className="admin-activity-filter">
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search ticket, person, team, action, or changed value..."
          value={query}
        />
        <select onChange={(event) => setActionFilter(event.target.value)} value={actionFilter}>
          {actionOptions.map((action) => (
            <option key={action} value={action}>{action === 'all' ? 'All actions' : action.replaceAll('_', ' ')}</option>
          ))}
        </select>
        <button onClick={() => { setQuery(''); setActionFilter('all'); }} type="button">Clear</button>
      </section>

      {loading ? <div className="admin-empty-state">Loading activity logs...</div> : null}
      {error ? <div className="login-alert">{error}</div> : null}

      {!loading && !error ? (
        <div className="admin-log-list">
          {filtered.map((log) => {
            const date = dayLine(log.created_at);
            return (
              <article className="admin-log-card" key={log.id}>
                <div className="admin-log-date">
                  <strong>{date.date}</strong>
                  <span>{date.time}</span>
                </div>
                <div className="admin-log-main">
                  <div className="admin-log-tags">
                    <span>{log.action === 'status_change' ? 'STATUS' : log.action === 'reschedule' ? 'SCHEDULE' : log.action === 'manual_ticket_created' ? 'CREATED' : 'ACTION'}</span>
                    {log.ticket_no ? <b>{log.ticket_no}</b> : log.legacy_request_id ? <b>#{log.legacy_request_id}</b> : null}
                    {log.field ? <b>{log.field.replaceAll('_', ' ')}</b> : null}
                  </div>
                  <button className="admin-log-title-button" onClick={() => setSelectedLog(log)} type="button">
                    {log.action_label}
                  </button>
                  <p>{log.summary}</p>
                </div>
                <div className="admin-log-actor compact">
                  <button
                    className="admin-log-small-link"
                    onClick={() => setSelectedLog(log)}
                    type="button"
                    aria-label={`View details for ${log.action_label}`}
                  >
                    View details
                  </button>
                </div>
              </article>
            );
          })}
          {!filtered.length ? <div className="admin-empty-state">No logs match the current filters.</div> : null}
        </div>
      ) : null}

      {selectedLog ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-log-modal">
            <div className="admin-log-modal-head">
              <div>
                <span>Activity Details</span>
                <h2>{selectedLog.action_label}</h2>
              </div>
              <button aria-label="Close activity details" onClick={() => setSelectedLog(null)} type="button">×</button>
            </div>
            <div className="admin-log-modal-body">
              <div className="admin-log-detail-grid">
                <section>
                  <span>Date / Time</span>
                  <strong>{readableDateTime(selectedLog.created_at)}</strong>
                </section>
                <section>
                  <span>Actor</span>
                  <strong>{selectedLog.actor_name || 'System'}</strong>
                  <small>{selectedLog.actor_role_label || selectedLog.user_role || 'User'}</small>
                  {selectedLog.actor_email ? <small>{selectedLog.actor_email}</small> : null}
                </section>
                <section>
                  <span>Ticket / Request</span>
                  <strong>{selectedLog.ticket_no || (selectedLog.legacy_request_id ? `#${selectedLog.legacy_request_id}` : selectedLog.ticket_id || 'N/A')}</strong>
                  {selectedLog.ticket_status ? <small>{selectedLog.ticket_status}</small> : null}
                </section>
                <section>
                  <span>Customer / Ticket Info</span>
                  <strong>{selectedLog.customer_name || selectedLog.ticket_location || 'No customer linked'}</strong>
                  <small>{[selectedLog.customer_phone, selectedLog.ticket_product, selectedLog.ticket_brand].filter(Boolean).join(' • ') || selectedLog.actor_email || 'ER audit log'}</small>
                </section>
              </div>

              <section className="admin-log-change-box">
                <span>Summary</span>
                <p>{selectedLog.summary}</p>
              </section>

              <div className="admin-log-before-after">
                <section>
                  <span>Changed Field</span>
                  <strong>{selectedLog.field?.replaceAll('_', ' ') || selectedLog.action_label}</strong>
                </section>
                <section>
                  <span>Ticket ID</span>
                  <strong>{selectedLog.ticket_id || 'N/A'}</strong>
                </section>
                <section>
                  <span>Before</span>
                  <strong>{selectedLog.old_value_label || selectedLog.old_value || 'N/A'}</strong>
                </section>
                <section>
                  <span>After</span>
                  <strong>{selectedLog.new_value_label || selectedLog.new_value || 'N/A'}</strong>
                </section>
              </div>

              {selectedLog.notes ? (
                <section className="admin-log-change-box">
                  <span>Notes</span>
                  <p>{selectedLog.notes}</p>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CustomersPage() {
  const { customers, loading, error, refresh, user } = useAdminCatalog('customers');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((customer) =>
      [customer.full_name, customer.email, customer.phone_number, customer.city, customer.state, customer.zip_code, customer.region]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [customers, query]);

  const active = customers.filter((customer) => customer.is_active).length;
  const inactive = customers.length - active;
  const totalRequests = customers.reduce((sum, customer) => sum + customer.request_count, 0);

  async function toggleCustomer(customer: CustomerRow) {
    if (!user) return;
    setNotice(null);
    try {
      await fetchJsonWithFirebase(user, `/api/admin/catalogs?type=customers&id=${encodeURIComponent(customer.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !customer.is_active }),
      });
      setNotice(`${customer.full_name} has been ${customer.is_active ? 'deactivated' : 'activated'}.`);
      await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to update customer.');
    }
  }

  return (
    <div className="admin-php-page customers">
      <AdminPageHero
        icon={<Users size={34} />}
        title="Customer Management"
        subtitle="View, search, activate, and deactivate customer accounts."
      >
        <span className="admin-date-pill"><CalendarDays size={13} /> Jun 18, 2026</span>
      </AdminPageHero>

      <div className="admin-php-count-grid four">
        <AdminCounterCard icon={<Users size={18} />} label="Total Customers" value={customers.length} />
        <AdminCounterCard icon={<UserCheck size={18} />} label="Active" value={active} />
        <AdminCounterCard icon={<UserRoundX size={18} />} label="Inactive" value={inactive} />
        <AdminCounterCard icon={<ClipboardList size={18} />} label="Total Requests" value={totalRequests} />
      </div>

      <section className="admin-php-form-panel">
        <div className="admin-php-panel-head"><h2>Search Customers</h2></div>
        <div className="admin-customer-search">
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, phone, city, or ZIP"
            value={query}
          />
          <button onClick={() => setQuery('')} type="button"><Search size={17} /> Search</button>
        </div>
        {notice ? <p className="admin-php-notice">{notice}</p> : null}
      </section>

      <AdminTablePanel count={`${filtered.length} records`} title="Customer Accounts">
        {loading ? <div className="admin-empty-state">Loading customers...</div> : null}
        {error ? <div className="login-alert">{error}</div> : null}
        {!loading && !error ? (
          <table className="admin-php-table admin-customer-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>City / ZIP</th>
                <th>Requests</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <div className="admin-customer-name">
                      <span>{initials(customer.full_name || customer.email) || 'CX'}</span>
                      <div>
                        <strong>{customer.full_name}</strong>
                        <small>ID #{customer.legacy_id ?? 'NEW'}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="admin-contact-lines">
                      <span><Mail size={14} /> {customer.email}</span>
                      <span><Phone size={14} /> {customer.phone_number || 'No phone'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-contact-lines">
                      <span><MapPin size={14} /> {[customer.city, customer.state].filter(Boolean).join(', ') || 'N/A'}</span>
                      <span>{customer.zip_code || 'No ZIP'}</span>
                    </div>
                  </td>
                  <td><span className="admin-count-pill">{customer.request_count}</span></td>
                  <td><span className={customer.is_active ? 'admin-status-pill active' : 'admin-status-pill inactive'}>{customer.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <button className="admin-action-primary" onClick={() => void toggleCustomer(customer)} type="button">
                      {customer.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr>
                  <td colSpan={6}>No customer records found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </AdminTablePanel>
    </div>
  );
}

export function AdminCatalogPage({ mode }: { mode: Mode }) {
  if (mode === 'brands') return <BrandsPage />;
  if (mode === 'appliances') return <AppliancesPage />;
  if (mode === 'activity-logs') return <ActivityLogsPage />;
  return <CustomersPage />;
}
