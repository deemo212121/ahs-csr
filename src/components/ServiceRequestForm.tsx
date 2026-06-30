'use client';

import { Clock, Package, Send, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import { useAuth } from '@/components/AuthProvider';
import { US_STATES } from '@/lib/data/usStates';

const brandOptions = [
  'Whirlpool',
  'Maytag',
  'GE',
  'Samsung',
  'LG',
  'Frigidaire',
  'KitchenAid',
  'Bosch',
  'Electrolux',
  'Kenmore',
  'Other',
];

const categoryOptions = [
  'Refrigerator',
  'Freezer',
  'Washer',
  'Dryer',
  'Dishwasher',
  'Range',
  'Oven',
  'Cooktop',
  'Microwave',
  'Other',
];

const heardOptions = ['Google', 'Facebook', 'Referral', 'Previous Customer', 'Website', 'Email', 'Phone Call', 'Other'];


type ServiceAreaOption = {
  id: string;
  legacy_id: number | null;
  zip_code: string;
  city: string;
  state: string;
  region: string;
  is_active: boolean;
};

const initialState = {
  full_name: '',
  phone_number: '',
  secondary_phone: '',
  customer_email: '',
  service_address: '',
  service_address_2: '',
  city: '',
  region: '',
  state: '',
  zip_code: '',
  landmark: '',
  manual_brand: '',
  brand_not_listed: false,
  manual_appliance_type: '',
  category_not_listed: false,
  model_number: '',
  serial_number: '',
  product_model_version: '',
  issue_description: '',
  special_request: '',
  preferred_date: '',
  purchase_date: '',
  warranty_type: '',
};

type FormState = typeof initialState;

export function ServiceRequestForm({ onCreated }: { onCreated?: () => void }) {
  const { user, profile } = useAuth();
  const [form, setForm] = useState<FormState>(initialState);
  const [zipMatches, setZipMatches] = useState<ServiceAreaOption[]>([]);
  const [zipLookupMessage, setZipLookupMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const customerName = useMemo(
    () => [profile?.first_name, profile?.last_name].filter(Boolean).join(' '),
    [profile?.first_name, profile?.last_name],
  );

  function update<K extends keyof FormState>(name: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function applyServiceArea(area: ServiceAreaOption) {
    setForm((current) => ({
      ...current,
      zip_code: area.zip_code,
      city: area.city,
      state: area.state,
      region: area.region,
    }));
    setZipLookupMessage(`${area.city}, ${area.state} | ${area.region}`);
  }

  function updateZip(value: string) {
    const zip = value.replace(/\D/g, '').slice(0, 5);
    update('zip_code', zip);
    if (zip.length < 5) {
      setZipMatches([]);
      setZipLookupMessage(null);
    }
  }

  useEffect(() => {
    const zip = form.zip_code.replace(/\D/g, '').slice(0, 5);
    if (zip.length !== 5) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/service-areas?zip=${encodeURIComponent(zip)}&limit=25`);
        const data = (await response.json()) as { service_areas?: ServiceAreaOption[]; message?: string };
        if (!response.ok) throw new Error(data.message || 'ZIP lookup failed.');
        if (cancelled) return;

        const matches = data.service_areas ?? [];
        setZipMatches(matches);
        if (matches.length > 0) {
          applyServiceArea(matches[0]);
        } else {
          setZipLookupMessage('This ZIP is not in the active service coverage list yet.');
        }
      } catch (err) {
        if (!cancelled) {
          setZipMatches([]);
          setZipLookupMessage(err instanceof Error ? err.message : 'Unable to check ZIP coverage.');
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.zip_code]);

  function resetForm() {
    setForm(initialState);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        ...form,
        full_name: form.full_name || customerName,
        customer_email: form.customer_email || profile?.email || '',
        phone_number: form.phone_number || profile?.phone_number || '',
        ticket_source: 'cx_online',
        source_label: 'CX Submission',
      };
      const data = await fetchJsonWithFirebase<{ request: { request_number: string } }>(
        user,
        '/api/service-requests',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );
      resetForm();
      setMessage(`Created ${data.request.request_number}.`);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create request.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="request-form-stack" onSubmit={submit}>
      <section className="request-section">
        <div className="request-section-title">
          <UserRound size={17} />
          <strong>Customer Information</strong>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Ticket No</label>
            <input disabled value="Auto-generated after submit" />
          </div>
          <div className="field">
            <label>Source</label>
            <input disabled value="CX Submission" />
          </div>
          <div className="field wide">
            <label>Name *</label>
            <input
              onChange={(event) => update('full_name', event.target.value)}
              required
              value={form.full_name || customerName}
            />
            <small>Auto-filled from the logged-in customer account.</small>
          </div>
          <div className="field">
            <label>Primary Phone *</label>
            <input
              onChange={(event) => update('phone_number', event.target.value)}
              required
              value={form.phone_number || profile?.phone_number || ''}
            />
          </div>
          <div className="field">
            <label>Secondary Phone <span>(Optional)</span></label>
            <input
              onChange={(event) => update('secondary_phone', event.target.value)}
              placeholder="Alternative phone number"
              value={form.secondary_phone}
            />
          </div>
          <div className="field">
            <label>Email *</label>
            <input
              onChange={(event) => update('customer_email', event.target.value)}
              required
              type="email"
              value={form.customer_email || profile?.email || ''}
            />
          </div>
          <div className="field wide">
            <label>Address *</label>
            <textarea
              onChange={(event) => update('service_address', event.target.value)}
              required
              value={form.service_address}
            />
          </div>
          <div className="field">
            <label>City *</label>
            <input onChange={(event) => update('city', event.target.value)} required value={form.city} />
          </div>
          <div className="field">
            <label>ZIP Code *</label>
            <input inputMode="numeric" maxLength={5} onChange={(event) => updateZip(event.target.value)} required value={form.zip_code} />
            {zipLookupMessage ? <small>{zipLookupMessage}</small> : null}
            {zipMatches.length > 1 ? (
              <select
                onChange={(event) => {
                  const area = zipMatches.find((match) => match.id === event.target.value);
                  if (area) applyServiceArea(area);
                }}
                value={zipMatches.find((match) => match.city === form.city && match.state === form.state && match.region === form.region)?.id ?? zipMatches[0]?.id ?? ''}
              >
                {zipMatches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.city}, {match.state} | {match.region}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <div className="field">
            <label>State *</label>
            <select onChange={(event) => update('state', event.target.value)} required value={form.state}>
              <option value="">Select State</option>
              {US_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Region</label>
            <input onChange={(event) => update('region', event.target.value)} value={form.region} />
          </div>
          <div className="field wide">
            <label>Address Note <span>(Optional)</span></label>
            <textarea
              onChange={(event) => update('landmark', event.target.value)}
              placeholder="Apartment, suite, gate code, building, floor, landmark, or delivery/service note"
              value={form.landmark}
            />
          </div>
        </div>
      </section>

      <section className="request-section">
        <div className="request-section-title">
          <Package size={17} />
          <strong>Product Information</strong>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Model *</label>
            <input
              onChange={(event) => update('model_number', event.target.value)}
              placeholder="e.g., RF28R7201SR"
              required
              value={form.model_number}
            />
          </div>
          <div className="field">
            <label>Serial *</label>
            <input
              onChange={(event) => update('serial_number', event.target.value)}
              placeholder="e.g., X3Z9Y7"
              required
              value={form.serial_number}
            />
          </div>
          <div className="field">
            <label>Model Version <span>(Optional)</span></label>
            <input
              onChange={(event) => update('product_model_version', event.target.value)}
              placeholder="e.g., Version 2 / Series A"
              value={form.product_model_version}
            />
          </div>
          <div className="field wide">
            <label>Brand *</label>
            {form.brand_not_listed ? (
              <input
                onChange={(event) => update('manual_brand', event.target.value)}
                placeholder="Enter brand"
                required
                value={form.manual_brand}
              />
            ) : (
              <select
                onChange={(event) => update('manual_brand', event.target.value)}
                required
                value={form.manual_brand}
              >
                <option value="">Select Brand</option>
                {brandOptions.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            )}
            <label className="checkbox-line">
              <input
                checked={form.brand_not_listed}
                onChange={(event) => {
                  update('brand_not_listed', event.target.checked);
                  update('manual_brand', '');
                }}
                type="checkbox"
              />
              My brand is not listed
            </label>
          </div>
          <div className="field wide">
            <label>Product Category *</label>
            {form.category_not_listed ? (
              <input
                onChange={(event) => update('manual_appliance_type', event.target.value)}
                placeholder="Enter product category"
                required
                value={form.manual_appliance_type}
              />
            ) : (
              <select
                onChange={(event) => update('manual_appliance_type', event.target.value)}
                required
                value={form.manual_appliance_type}
              >
                <option value="">Select Category</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            )}
            <label className="checkbox-line">
              <input
                checked={form.category_not_listed}
                onChange={(event) => {
                  update('category_not_listed', event.target.checked);
                  update('manual_appliance_type', '');
                }}
                type="checkbox"
              />
              My product category is not listed
            </label>
          </div>
          <div className="field">
            <label>Purchase Date <span>(Optional)</span></label>
            <input type="date" value={form.purchase_date} onChange={(e) => update('purchase_date', e.target.value)} />
          </div>
          <div className="field">
            <label>How did you hear about us? *</label>
            <select onChange={(event) => update('warranty_type', event.target.value)} required value={form.warranty_type}>
              <option value="">Select how you heard about us</option>
              {heardOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="request-section">
        <div className="request-section-title">
          <Clock size={17} />
          <strong>Service Details</strong>
        </div>
        <div className="form-grid">
          <div className="field wide">
            <label>Cx Preferred Date *</label>
            <input type="date" value={form.preferred_date} onChange={(e) => update('preferred_date', e.target.value)} required />
          </div>
          <div className="field wide">
            <label>Problem Description *</label>
            <textarea
              onChange={(event) => update('issue_description', event.target.value)}
              placeholder="Please describe the issue with your appliance..."
              required
              value={form.issue_description}
            />
          </div>
          <div className="field wide">
            <label>Special Request <span>(Optional)</span></label>
            <textarea
              onChange={(event) => update('special_request', event.target.value)}
              placeholder="Please describe any special requests or instructions..."
              value={form.special_request}
            />
          </div>
        </div>
      </section>

      <button className="btn btn-primary request-submit" disabled={saving} type="submit">
        <Send size={17} />
        {saving ? 'Submitting...' : 'Submit Request'}
      </button>
      {message ? <span className="success">{message}</span> : null}
      {error ? <span className="error">{error}</span> : null}
    </form>
  );
}
