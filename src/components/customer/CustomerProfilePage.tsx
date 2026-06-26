'use client';

import { Save, UserRound } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

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
  const { profile } = useAuth();
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Customer';

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
            <input defaultValue={profile?.first_name || ''} />
          </label>
          <label>
            <span>Last Name</span>
            <input defaultValue={profile?.last_name || ''} />
          </label>
          <label className="wide">
            <span>Email</span>
            <input defaultValue={profile?.email || ''} readOnly />
            <small>Email cannot be changed</small>
          </label>
          <label className="wide">
            <span>Phone Number</span>
            <input defaultValue={profile?.phone_number || ''} />
          </label>
          <label className="wide">
            <span>Address</span>
            <textarea defaultValue={profile?.address || ''} />
          </label>
          <label>
            <span>City</span>
            <input defaultValue={profile?.city || ''} />
          </label>
          <label>
            <span>State</span>
            <input defaultValue={profile?.state || ''} />
          </label>
          <label>
            <span>ZIP Code</span>
            <input defaultValue={profile?.zip_code || ''} />
          </label>
          <label>
            <span>Region</span>
            <input defaultValue={profile?.region || ''} />
          </label>
        </div>
        <button className="btn btn-primary cx-save-profile" type="button">
          <Save size={17} />
          Save Profile
        </button>
      </section>
    </div>
  );
}
