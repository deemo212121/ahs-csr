'use client';

import { ClipboardPlus, Save } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import { US_STATES } from '@/lib/data/usStates';

type ManualForm = {
  request_number: string;
  fake_ticket: boolean;
  ticket_source: string;
  full_name: string;
  phone_number: string;
  secondary_phone: string;
  customer_email: string;
  service_address: string;
  service_address_2: string;
  region: string;
  city: string;
  zip_code: string;
  state: string;
  landmark: string;
  manual_brand: string;
  manual_appliance_type: string;
  model_number: string;
  serial_number: string;
  product_model_version: string;
  purchase_date: string;
  issue_description: string;
  special_request: string;
  preferred_date: string;
  warranty_type: string;
};

type ServiceAreaOption = {
  id: string;
  zip_code: string;
  city: string;
  state: string;
  region: string;
};

type CustomerMatch = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  region: string | null;
};

const initialForm: ManualForm = {
  request_number: '',
  fake_ticket: false,
  ticket_source: 'Phone Call',
  full_name: '',
  phone_number: '',
  secondary_phone: '',
  customer_email: '',
  service_address: '',
  service_address_2: '',
  region: '',
  city: '',
  zip_code: '',
  state: '',
  landmark: '',
  manual_brand: '',
  manual_appliance_type: '',
  model_number: '',
  serial_number: '',
  product_model_version: '',
  purchase_date: '',
  issue_description: '',
  special_request: '',
  preferred_date: '',
  warranty_type: '',
};

export function TeamManualTicketPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<ManualForm>(initialForm);
  const [zipMatches, setZipMatches] = useState<ServiceAreaOption[]>([]);
  const [zipMessage, setZipMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([]);
  const [showCustomerMatches, setShowCustomerMatches] = useState(false);

  function update<K extends keyof ManualForm>(name: K, value: ManualForm[K]) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function applyArea(area: ServiceAreaOption) {
    setForm((current) => ({
      ...current,
      zip_code: area.zip_code,
      city: area.city,
      state: area.state,
      region: area.region,
    }));
    setZipMessage(`${area.city}, ${area.state} · ${area.region}`);
  }

  function applyCustomerMatch(customer: CustomerMatch) {
    setForm((current) => ({
      ...current,
      full_name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || current.full_name,
      customer_email: customer.email || current.customer_email,
      phone_number: customer.phone_number || current.phone_number,
      service_address: customer.address || current.service_address,
      city: customer.city || current.city,
      state: customer.state || current.state,
      zip_code: customer.zip_code || current.zip_code,
      region: customer.region || current.region,
    }));
    setShowCustomerMatches(false);
  }

  useEffect(() => {
    const query = form.customer_email.trim();
    if (query.length < 2 || !user) {
      setCustomerMatches([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const data = await fetchJsonWithFirebase<{ customers: CustomerMatch[] }>(
          user,
          `/api/customers/search?q=${encodeURIComponent(query)}`,
        );
        if (!cancelled) setCustomerMatches(data.customers);
      } catch {
        if (!cancelled) setCustomerMatches([]);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.customer_email, user]);

  useEffect(() => {
    const zip = form.zip_code.replace(/\D/g, '').slice(0, 5);
    if (zip.length !== 5) {
      setZipMatches([]);
      setZipMessage(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/service-areas?zip=${encodeURIComponent(zip)}&limit=25`);
        const data = (await response.json()) as { service_areas?: ServiceAreaOption[]; message?: string };
        if (!response.ok) throw new Error(data.message || 'ZIP lookup failed.');
        if (cancelled) return;
        const matches = data.service_areas ?? [];
        setZipMatches(matches);
        if (matches[0]) applyArea(matches[0]);
        else setZipMessage('This ZIP is not in the active service coverage list yet.');
      } catch (err) {
        if (!cancelled) setZipMessage(err instanceof Error ? err.message : 'Unable to check ZIP coverage.');
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.zip_code]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = {
        request_number: form.request_number,
        fake_ticket: form.fake_ticket,
        full_name: form.full_name,
        phone_number: form.phone_number,
        secondary_phone: form.secondary_phone,
        customer_email: form.customer_email,
        ticket_source: form.ticket_source === 'Phone Call' ? 'csr_manual_phone_call' : 'csr_manual',
        service_address: form.service_address,
        service_address_2: form.service_address_2,
        city: form.city,
        region: form.region,
        state: form.state,
        zip_code: form.zip_code,
        landmark: form.landmark,
        manual_brand: form.manual_brand,
        manual_appliance_type: form.manual_appliance_type,
        model_number: form.model_number,
        serial_number: form.serial_number,
        product_model_version: form.product_model_version,
        purchase_date: form.purchase_date,
        issue_description: form.issue_description,
        special_request: form.special_request,
        preferred_date: form.preferred_date,
        warranty_type: form.warranty_type,
      };
      const data = await fetchJsonWithFirebase<{ request: { request_number: string } }>(user, '/api/service-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setForm(initialForm);
      setZipMatches([]);
      setZipMessage(null);
      setMessage(`Manual ticket created: ${data.request.request_number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create manual ticket.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="manager-dashboard php-manager-page manager-manual-page team-manual-page">
      <section className="manager-page-title-row manual">
        <div>
          <h1><ClipboardPlus size={38} /> Manual Ticket Entry</h1>
          <p>For CSR phone calls. Enter the customer and product details, then submit the ticket into the request queue.</p>
        </div>
      </section>

      {message ? <div className="success-text">{message}</div> : null}
      {error ? <div className="customer-alert">{error}</div> : null}

      <form className="manager-manual-form-panel" onSubmit={submit}>
        <section className="request-section">
          <div className="request-section-title">Customer Information</div>
          <div className="form-grid manual-grid">
            <div className="field"><label>Ticket No *</label><input value={form.request_number} onChange={(event) => update('request_number', event.target.value)} placeholder="Auto if blank" /></div>
            <label className="manual-checkbox"><input checked={form.fake_ticket} onChange={(event) => update('fake_ticket', event.target.checked)} type="checkbox" /> Fake Ticket (not included statistically)</label>
            <div className="field"><label>Source *</label><select value={form.ticket_source} onChange={(event) => update('ticket_source', event.target.value)}><option>Phone Call</option><option>Customer Follow-up</option><option>Email</option><option>CSR Manual</option></select></div>
            <div className="field"><label>Name *</label><input required value={form.full_name} onChange={(event) => update('full_name', event.target.value)} /></div>
            <div className="field"><label>Primary Phone *</label><input required value={form.phone_number} onChange={(event) => update('phone_number', event.target.value)} /></div>
            <div className="field"><label>Secondary Phone</label><input value={form.secondary_phone} onChange={(event) => update('secondary_phone', event.target.value)} /></div>
            <div className="field manual-customer-search">
              <label>Email</label>
              <input
                autoComplete="off"
                onBlur={() => window.setTimeout(() => setShowCustomerMatches(false), 150)}
                onChange={(event) => {
                  update('customer_email', event.target.value);
                  setShowCustomerMatches(true);
                }}
                onFocus={() => setShowCustomerMatches(true)}
                type="email"
                value={form.customer_email}
              />
              {showCustomerMatches && customerMatches.length ? (
                <div className="manual-customer-dropdown">
                  {customerMatches.map((customer) => (
                    <button
                      key={customer.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyCustomerMatch(customer)}
                      type="button"
                    >
                      <strong>{customer.email}</strong>
                      <span>{[customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Existing customer'}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="field wide"><label>Address *</label><input required value={form.service_address} onChange={(event) => update('service_address', event.target.value)} /></div>
            <div className="field"><label>Region *</label><input required value={form.region} onChange={(event) => update('region', event.target.value)} /></div>
            <div className="field"><label>City *</label><input required value={form.city} onChange={(event) => update('city', event.target.value)} /></div>
            <div className="field"><label>Zip Code *</label><input required value={form.zip_code} onChange={(event) => update('zip_code', event.target.value.replace(/\D/g, '').slice(0, 5))} /></div>
            <div className="field"><label>State *</label><select required value={form.state} onChange={(event) => update('state', event.target.value)}><option value="">Select State</option>{US_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select></div>
            {zipMessage ? <div className="manual-zip-message">{zipMessage}</div> : null}
            {zipMatches.length > 1 ? (
              <div className="manual-zip-options">
                {zipMatches.map((area) => <button key={area.id} type="button" onClick={() => applyArea(area)}>{area.city}, {area.state}</button>)}
              </div>
            ) : null}
            <div className="field wide"><label>Address Note</label><textarea value={form.landmark} onChange={(event) => update('landmark', event.target.value)} rows={2} /></div>
          </div>
        </section>

        <section className="request-section">
          <div className="request-section-title">Product / Service Information</div>
          <div className="form-grid manual-grid">
            <div className="field"><label>Appliance *</label><input required value={form.manual_appliance_type} onChange={(event) => update('manual_appliance_type', event.target.value)} placeholder="Example: Refrigerator" /></div>
            <div className="field"><label>Brand *</label><input required value={form.manual_brand} onChange={(event) => update('manual_brand', event.target.value)} placeholder="Example: GE" /></div>
            <div className="field"><label>Model Number</label><input value={form.model_number} onChange={(event) => update('model_number', event.target.value)} /></div>
            <div className="field"><label>Serial Number</label><input value={form.serial_number} onChange={(event) => update('serial_number', event.target.value)} /></div>
            <div className="field"><label>Model Version</label><input value={form.product_model_version} onChange={(event) => update('product_model_version', event.target.value)} /></div>
            <div className="field"><label>Purchase Date</label><input type="date" value={form.purchase_date} onChange={(event) => update('purchase_date', event.target.value)} /></div>
            <div className="field"><label>Preferred Date</label><input type="date" value={form.preferred_date} onChange={(event) => update('preferred_date', event.target.value)} /></div>
            <div className="field"><label>Warranty Type</label><select value={form.warranty_type} onChange={(event) => update('warranty_type', event.target.value)}><option value="">Select warranty</option><option>Manufacturer</option><option>Extended Warranty</option><option>Out of Warranty</option></select></div>
            <div className="field wide"><label>Problem / Notes *</label><textarea required value={form.issue_description} onChange={(event) => update('issue_description', event.target.value)} rows={4} /></div>
            <div className="field wide"><label>Special Request</label><textarea value={form.special_request} onChange={(event) => update('special_request', event.target.value)} rows={3} /></div>
          </div>
        </section>

        <button className="btn btn-primary manual-submit" disabled={saving} type="submit"><Save size={16} /> {saving ? 'Saving...' : 'Create Manual Ticket'}</button>
      </form>
    </div>
  );
}
