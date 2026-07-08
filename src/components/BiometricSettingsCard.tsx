'use client';

import { Fingerprint } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { disableBiometricLogin, hasBiometricLoginEnabled, isBiometricAvailable, isNativePlatform } from '@/lib/biometric';

// Nothing to show in a regular browser tab, and nothing to show until the
// customer has actually turned biometric login on from the login screen
// itself (that's the only place we ever have their password in hand to
// store against the device's secure credential store). This card is just
// the "turn it back off" control, plus a status readout.
export function BiometricSettingsCard() {
  const { user } = useAuth();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isNativePlatform()) {
      setReady(true);
      return;
    }
    Promise.all([isBiometricAvailable(), hasBiometricLoginEnabled()]).then(([avail, on]) => {
      if (cancelled) return;
      setAvailable(avail);
      setEnabled(on);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || !isNativePlatform() || !available || !user?.uid) return null;

  async function turnOff() {
    setBusy(true);
    try {
      await disableBiometricLogin();
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cx-edit-profile-card cx-biometric-card">
      <div className="cx-card-title">
        <Fingerprint size={17} />
        <strong>Fingerprint / Face Login</strong>
      </div>
      <p>
        {enabled
          ? 'Fingerprint/face login is on for this device.'
          : 'Off — turn this on next time you log in with your password, look for the fingerprint option on the login screen.'}
      </p>
      <label className="cx-biometric-toggle-row">
        <span>Enable fingerprint / face unlock</span>
        <span className="toggle-switch">
          <input
            checked={enabled}
            disabled={busy || !enabled}
            onChange={() => void turnOff()}
            type="checkbox"
          />
          <span className="toggle-switch-track" />
        </span>
      </label>
    </section>
  );
}
