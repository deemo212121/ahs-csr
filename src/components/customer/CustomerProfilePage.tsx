'use client';

import { Save, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import { US_STATES } from '@/lib/data/usStates';

type ServiceAreaOption = {
  id: string;
  zip_code: string;
  city: string;
  state: string;
  region: string;
};

function memberSince(value?: string | null) {
  const fallback = new Date();
  const parsed = value ? new Date(value) : fallback;
  const date = Number.isNaN(parsed.getTime()) || parsed.getFullYear() < 2020 ? fallback : parsed;

  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export function CustomerProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Customer';

  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [city, setCity] = useState(profile?.city || '');
  const [state, setState] = useState(profile?.state || '');
  const [region, setRegion] = useState(profile?.region || '');
  const [zipCode, setZipCode] = useState(profile?.zip_code || '');
  const [zipMatches, setZipMatches] = useState<ServiceAreaOption[]>([]);
  const [zipMessage, setZipMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    try {
      await fetchJsonWithFirebase(user, '/api/me', {
        method: 'PATCH',
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber,
          address,
          city,
          state,
          region,
          zip_code: zipCode,
        }),
      });
      await refreshProfile();
      setShowSavedToast(true);
      window.setTimeout(() => setShowSavedToast(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  }

  function applyServiceArea(area: ServiceAreaOption) {
    setCity(area.city);
    setState(area.state);
    setRegion(area.region);
    setZipMessage(`${area.city}, ${area.state} | ${area.region}`);
  }

  useEffect(() => {
    const zip = zipCode.replace(/\D/g, '').slice(0, 5);
    if (zip.length !== 5) {
      setZipMatches([]);
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
        if (matches.length > 0) {
          applyServiceArea(matches[0]);
        } else {
          setZipMessage('This ZIP is not in the active service coverage list yet.');
        }
      } catch (err) {
        if (!cancelled) {
          setZipMatches([]);
          setZipMessage(err instanceof Error ? err.message : 'Unable to check ZIP coverage.');
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [zipCode]);

  return (
    <div className="customer-page-shell cx-profile-page">
      <section className="cx-profile-hero">
        <div className="cx-profile-avatar"><UserRound size={54} /></div>
        <h1>{fullName}</h1>
        <p>Member since {memberSince(profile?.created_at)}</p>
      </section>

      <section className="cx-edit-profile-card">
        <div className="cx-card-title"><UserRound size={17} /><strong>Edit Profile</strong></div>
        <div className="cx-profile-form">
          <label>
            <span>First Name</span>
            <input onChange={(event) => setFirstName(event.target.value)} value={firstName} />
          </label>
          <label>
            <span>Last Name</span>
            <input onChange={(event) => setLastName(event.target.value)} value={lastName} />
          </label>
          <label className="wide">
            <span>Email</span>
            <input defaultValue={profile?.email || ''} readOnly />
            <small>Email cannot be changed</small>
          </label>
          <label className="wide">
            <span>Phone Number</span>
            <input onChange={(event) => setPhoneNumber(event.target.value)} value={phoneNumber} />
          </label>
          <label className="wide">
            <span>Address</span>
            <textarea onChange={(event) => setAddress(event.target.value)} value={address} />
          </label>
          <label>
            <span>City</span>
            <input onChange={(event) => setCity(event.target.value)} value={city} />
          </label>
          <label>
            <span>State</span>
            <select onChange={(event) => setState(event.target.value)} value={state}>
              <option value="">Select State</option>
              {US_STATES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>ZIP Code</span>
            <input
              inputMode="numeric"
              maxLength={5}
              onChange={(event) => setZipCode(event.target.value.replace(/\D/g, '').slice(0, 5))}
              value={zipCode}
            />
            {zipMessage ? <small>{zipMessage}</small> : null}
            {zipMatches.length > 1 ? (
              <select
                onChange={(event) => {
                  const area = zipMatches.find((match) => match.id === event.target.value);
                  if (area) applyServiceArea(area);
                }}
                value={zipMatches.find((match) => match.city === city && match.state === state && match.region === region)?.id ?? zipMatches[0]?.id ?? ''}
              >
                {zipMatches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.city}, {match.state} | {match.region}
                  </option>
                ))}
              </select>
            ) : null}
          </label>
          <label>
            <span>Region</span>
            <input onChange={(event) => setRegion(event.target.value)} value={region} />
          </label>
        </div>
        {saveError ? <div className="customer-alert">{saveError}</div> : null}
        <button className="btn btn-primary cx-save-profile" disabled={saving} onClick={() => void saveProfile()} type="button">
          <Save size={17} />
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </section>

      {showSavedToast ? <div className="cx-saved-toast">Saved profile</div> : null}
    </div>
  );
}
