'use client';

export const dynamic = 'force-dynamic';

import { Eye, EyeOff } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updateCustomerPassword } = useAuth();

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setCheckingSession(false);
      return;
    }
    // The reset link Supabase emailed puts a recovery token in the URL —
    // the client (detectSessionInUrl: true) picks it up automatically and
    // briefly establishes a session for it, which is what lets updateUser()
    // below actually work.
    supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(Boolean(data.session));
      setCheckingSession(false);
    });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await updateCustomerPassword(password);
      setDone(true);
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen login-page-shell">
      <ThemeToggle className="login-theme-toggle" />
      <div className="login-container">
        <div className="login-card login-panel">
          <div className="login-header">
            <div className="ushs-logo">
              <img alt="USHS Logo" src="/admin-hub-logo.png" />
            </div>
            <h2>Reset Password</h2>
          </div>

          <div className="login-body">
            {checkingSession ? (
              <p className="text-center">Checking your reset link...</p>
            ) : !hasRecoverySession ? (
              <div className="login-alert">
                This reset link is invalid or has expired. Go back to the login page and request a new one.
              </div>
            ) : done ? (
              <div className="login-alert success">Password updated! Redirecting you to login...</div>
            ) : (
              <form onSubmit={submit}>
                {error ? <div className="login-alert">{error}</div> : null}

                <div className="mb-3 field">
                  <label htmlFor="new_password">New Password</label>
                  <div className="password-wrapper">
                    <input
                      autoComplete="new-password"
                      className="form-control"
                      id="new_password"
                      name="new_password"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                    />
                    <button
                      aria-label="Show or hide password"
                      className="toggle-password"
                      onClick={() => setShowPassword((value) => !value)}
                      type="button"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div className="mb-3 field">
                  <label htmlFor="confirm_password">Confirm New Password</label>
                  <input
                    autoComplete="new-password"
                    className="form-control"
                    id="confirm_password"
                    name="confirm_password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter your new password"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                  />
                </div>

                <button className="btn-login" disabled={submitting} type="submit">
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
