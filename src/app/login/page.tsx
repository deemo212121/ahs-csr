'use client';

export const dynamic = 'force-dynamic';

import { Eye, EyeOff, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { roleHome } from '@/lib/types';
import { getDemoRoleForCredentials } from '@/lib/auth/client';
import { isFirebaseConfigured } from '@/lib/firebase/client';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const {
    user,
    home,
    loading,
    loginWithTestRole,
    loginWithStaffEmail,
    loginWithCustomerEmail,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && home) {
      router.replace(home);
    }
  }, [loading, user, home, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const demoRole = getDemoRoleForCredentials(email, password);
      if (demoRole) {
        if (remember && typeof window !== 'undefined') {
          window.localStorage.setItem('ushs_remember_email', email.trim());
        }
        await loginWithTestRole(demoRole);
        router.replace(roleHome[demoRole]);
        return;
      }

      let staffError: unknown = null;
      let customerError: unknown = null;

      if (isFirebaseConfigured) {
        try {
          await loginWithStaffEmail(email, password);
          if (remember && typeof window !== 'undefined') {
            window.localStorage.setItem('ushs_remember_email', email.trim());
          }
          return;
        } catch (err) {
          staffError = err;
        }
      }

      if (isSupabaseConfigured) {
        try {
          await loginWithCustomerEmail(email, password);
          if (remember && typeof window !== 'undefined') {
            window.localStorage.setItem('ushs_remember_email', email.trim());
          }
          return;
        } catch (err) {
          customerError = err;
        }
      }

      if (!isFirebaseConfigured && !isSupabaseConfigured) {
        throw new Error('Firebase and Supabase are not configured yet. Use the local sample accounts or add your keys in .env.local.');
      }

      const message =
        customerError instanceof Error
          ? customerError.message
          : staffError instanceof Error
            ? staffError.message
            : 'Invalid email or password.';
      throw new Error(message || 'Invalid email or password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedEmail = window.localStorage.getItem('ushs_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRemember(true);
    }
  }, []);

  return (
    <main className="login-screen login-page-shell">
      <div className="login-container">
        <div className="login-card login-panel">
          <div className="login-header">
            <div className="ushs-logo">
              <img alt="USHS Logo" src="/admin-hub-logo.png" />
            </div>
            <h2>USHS Portal</h2>
          </div>

          <div className="login-body">
            {error ? <div className="login-alert">{error}</div> : null}

            <form onSubmit={submit}>
              <div className="mb-3 field">
                <label htmlFor="email">Email</label>
                <input
                  autoComplete="email"
                  className="form-control"
                  id="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  required
                  type="email"
                  value={email}
                />
              </div>

              <div className="mb-3 field">
                <label htmlFor="login_password">Password</label>
                <div className="password-wrapper">
                  <input
                    autoComplete="current-password"
                    className="form-control"
                    id="login_password"
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
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

              <div className="mb-3 form-check remember-row">
                <input
                  checked={remember}
                  className="form-check-input"
                  id="remember"
                  name="remember"
                  onChange={(event) => setRemember(event.target.checked)}
                  type="checkbox"
                />
                <label className="form-check-label remember-text" htmlFor="remember">
                  Remember Me
                </label>
              </div>

              <button className="btn-login" disabled={submitting} type="submit">
                {submitting ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <div className="text-center mt-4 create-account-area">
              <p className="mb-2 create-account-text">Don&apos;t have an account?</p>
              <Link className="btn create-account-btn" href="/customer/register">
                <UserPlus size={16} />
                Create Customer Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
