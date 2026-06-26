'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Eye, KeyRound, Mail, Save, Settings, Shield, UserRoundCog } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

function todayLabel() {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
}

export function AdminSettingsPage() {
  const { profile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name || 'System');
  const [lastName, setLastName] = useState(profile?.last_name || 'Admin');
  const [email, setEmail] = useState(profile?.email || 'admin@ushs.local');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const fullName = useMemo(() => [firstName, lastName].filter(Boolean).join(' ') || 'System Admin', [firstName, lastName]);

  function saveProfile() {
    setNotice('Profile design is connected to the admin profile form. Backend save can be wired after Firebase staff accounts are finalized.');
  }

  function updatePassword() {
    if (newPassword.length < 8) {
      setNotice('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice('New password and confirm password do not match.');
      return;
    }
    setNotice('Password form is ready. Real password updates should use Firebase Authentication after the live staff accounts are created.');
  }

  return (
    <div className="admin-php-page settings">
      <section className="admin-php-hero">
        <div className="admin-php-hero-title">
          <span><Settings size={34} /></span>
          <div>
            <h1>Admin Settings</h1>
            <p>Manage your admin profile, password, and system reference notes.</p>
          </div>
        </div>
        <span className="admin-date-pill"><CalendarDays size={13} /> {todayLabel()}</span>
      </section>

      <section className="admin-profile-hero">
        <div className="admin-profile-avatar">{firstName[0] ?? 'S'}{lastName[0] ?? 'A'}</div>
        <div>
          <h2>{fullName}</h2>
          <p><Mail size={14} /> {email}</p>
          <p><Shield size={14} /> Administrator Account</p>
        </div>
      </section>

      {notice ? <div className="admin-easy-note">{notice}</div> : null}

      <div className="admin-settings-grid">
        <section className="admin-php-form-panel">
          <div className="admin-php-panel-head"><h2><UserRoundCog size={16} /> Admin Profile</h2></div>
          <div className="admin-settings-form">
            <label>
              First Name
              <input onChange={(event) => setFirstName(event.target.value)} value={firstName} />
            </label>
            <label>
              Last Name
              <input onChange={(event) => setLastName(event.target.value)} value={lastName} />
            </label>
            <label>
              Email
              <input onChange={(event) => setEmail(event.target.value)} value={email} />
            </label>
            <button className="admin-blue-button wide" onClick={saveProfile} type="button"><Save size={17} /> Save Profile</button>
          </div>
        </section>

        <section className="admin-php-form-panel">
          <div className="admin-php-panel-head"><h2><KeyRound size={16} /> Change Password</h2></div>
          <div className="admin-settings-form">
            <label>
              New Password
              <span className="admin-password-field">
                <input onChange={(event) => setNewPassword(event.target.value)} placeholder="Enter new password" type="password" value={newPassword} />
                <Eye size={16} />
              </span>
            </label>
            <label>
              Confirm Password
              <span className="admin-password-field">
                <input onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" type="password" value={confirmPassword} />
                <Eye size={16} />
              </span>
            </label>
            <div className="admin-password-note">
              Use at least 8 characters. For better security, use a mix of uppercase letters, lowercase letters, numbers, and symbols.
            </div>
            <button className="admin-yellow-button wide" onClick={updatePassword} type="button"><KeyRound size={17} /> Update Password</button>
          </div>
        </section>
      </div>
    </div>
  );
}
