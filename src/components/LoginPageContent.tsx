'use client';

import { Eye, EyeOff, Fingerprint, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { roleHome } from '@/lib/types';
import { getDemoRoleForCredentials } from '@/lib/auth/client';
import { isFirebaseConfigured } from '@/lib/firebase/client';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  enableBiometricLogin,
  hasBiometricLoginEnabled,
  isBiometricAvailable,
  isNativePlatform,
  loginWithBiometric,
} from '@/lib/biometric';

// Shared by both the plain /login page and /login/[companyId] — identical
// behavior either way, except a companySlug adds a validation step up front
// and points "Create Account" at that same company's register link, so a
// customer arriving via a company-specific link never loses that context.
export function LoginPageContent({ companySlug }: { companySlug?: string }) {
  const router = useRouter();
  const {
    user,
    home,
    loading,
    loginWithTestRole,
    loginWithStaffEmail,
    loginWithCustomerEmail,
    requestPasswordReset,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const [companyState, setCompanyState] = useState<'checking' | 'valid' | 'invalid'>(
    companySlug ? 'checking' : 'valid',
  );
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    if (!companySlug) return;
    let cancelled = false;
    fetch(`/api/companies/${encodeURIComponent(companySlug)}`)
      .then((res) => res.json())
      .then((data: { valid: boolean; companyName?: string }) => {
        if (cancelled) return;
        if (data.valid) {
          setCompanyName(data.companyName ?? null);
          setCompanyState('valid');
        } else {
          setCompanyState('invalid');
        }
      })
      .catch(() => {
        if (!cancelled) setCompanyState('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [companySlug]);

  useEffect(() => {
    if (!isNativePlatform()) return;
    isBiometricAvailable().then((available) => {
      if (!available) return;
      hasBiometricLoginEnabled().then(setBiometricEnabled);
    });
  }, []);

  async function submitWithBiometric() {
    setSubmitting(true);
    setError(null);
    try {
      const creds = await loginWithBiometric();
      if (!creds) {
        setError('Fingerprint/face check failed. Use your password instead.');
        return;
      }
      await loginWithStaffEmail(creds.email, creds.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log in with biometrics.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitResetRequest(event: FormEvent) {
    event.preventDefault();
    if (!resetEmail.trim()) return;
    setResetSubmitting(true);
    setResetMessage(null);
    try {
      await requestPasswordReset(resetEmail);
      setResetMessage(`If an account exists for ${resetEmail}, we've sent a password reset link to it.`);
    } finally {
      setResetSubmitting(false);
    }
  }

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
          if (isNativePlatform() && !biometricEnabled && (await isBiometricAvailable())) {
            if (window.confirm('Enable fingerprint/face login for next time?')) {
              await enableBiometricLogin(email, password);
            }
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

  const createAccountHref = companySlug ? `/customer/register/${companySlug}` : '/customer/register';

  return (
    <main className="login-screen login-page-shell">
      <ThemeToggle className="login-theme-toggle" />
      <div className="login-container">
        <div className="login-card login-panel">
          <div className="login-header">
            <div className="ushs-logo">
              <img alt="USHS Logo" src="/admin-hub-logo.png" />
            </div>
            <h2>USHS Portal</h2>
            {companyState === 'valid' && companyName ? <p className="login-company-banner">Logging into {companyName}</p> : null}
          </div>

          {companyState === 'checking' ? (
            <div className="login-body">
              <p className="text-center">Checking company link...</p>
            </div>
          ) : companyState === 'invalid' ? (
            <div className="login-body">
              <div className="login-alert">
                This company link isn&apos;t recognized. Double-check the link, or go to the regular login page.
              </div>
              <div className="text-center mt-4">
                <Link className="btn create-account-btn" href="/login">
                  Go to regular login
                </Link>
              </div>
            </div>
          ) : (
            <div className="login-body">
              {error ? <div className="login-alert">{error}</div> : null}

              {biometricEnabled ? (
                <button
                  className="login-biometric-btn"
                  disabled={submitting}
                  onClick={() => void submitWithBiometric()}
                  type="button"
                >
                  <Fingerprint size={18} />
                  {submitting ? 'Checking...' : 'Log in with Fingerprint/Face'}
                </button>
              ) : null}

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

                <div className="mb-3 form-check remember-row login-remember-row">
                  <div>
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
                  <button
                    className="login-forgot-link"
                    onClick={() => {
                      setShowResetForm((value) => !value);
                      setResetMessage(null);
                      setResetEmail(email);
                    }}
                    type="button"
                  >
                    Forgot password?
                  </button>
                </div>

                <button className="btn-login" disabled={submitting} type="submit">
                  {submitting ? 'Logging in...' : 'Login'}
                </button>
              </form>

              {showResetForm ? (
                <form className="login-reset-form" onSubmit={submitResetRequest}>
                  {resetMessage ? <div className="login-alert success">{resetMessage}</div> : null}
                  <div className="mb-3 field">
                    <label htmlFor="reset_email">Enter your account email</label>
                    <input
                      autoComplete="email"
                      className="form-control"
                      id="reset_email"
                      name="reset_email"
                      onChange={(event) => setResetEmail(event.target.value)}
                      placeholder="you@example.com"
                      required
                      type="email"
                      value={resetEmail}
                    />
                  </div>
                  <button className="btn create-account-btn" disabled={resetSubmitting} type="submit">
                    {resetSubmitting ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>
              ) : null}

              <div className="text-center mt-4 create-account-area">
                <p className="mb-2 create-account-text">Don&apos;t have an account?</p>
                <Link className="btn create-account-btn" href={createAccountHref}>
                  <UserPlus size={16} />
                  Create Customer Account
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
