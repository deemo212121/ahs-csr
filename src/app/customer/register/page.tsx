'use client';

export const dynamic = 'force-dynamic';

import { CheckCircle, Eye, EyeOff, Info, Lock, Mail, Phone, UserPlus, Wrench, X } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

type ServiceAreaLookup = {
  service_areas?: Array<{
    id: string;
    zip_code: string;
    city: string;
    state: string;
    region: string;
  }>;
};

type ModalName = 'terms' | 'privacy' | null;

function passwordLevel(password: string) {
  if (!password) return '';
  if (password.length < 8) return 'weak';
  let score = 0;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;
  if (score < 2) return 'weak';
  if (score < 3) return 'medium';
  return 'strong';
}

function PolicyModal({ modal, onClose, onViewed }: { modal: ModalName; onClose: () => void; onViewed: (modal: Exclude<ModalName, null>) => void }) {
  if (!modal) return null;

  const isTerms = modal === 'terms';
  const title = isTerms ? 'Terms and Conditions' : 'Privacy Policy';

  return (
    <div className="register-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-modal="true"
        className="register-modal"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Close" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <div className="terms-copy">
          {isTerms ? (
            <>
              <h6>1. Service Agreement</h6>
              <p>By using our service, you agree to provide accurate and complete information when submitting a service request. This includes your name, contact details, service address, appliance information, and problem description.</p>
              <p>Customers are responsible for making sure the information provided is correct. Inaccurate or incomplete details may cause delays in scheduling, diagnosis, or service completion.</p>

              <h6>2. Service Scheduling</h6>
              <p>Preferred service dates are requests only and are not guaranteed until confirmed by the company via phone call or text message.</p>
              <p>Since service requests may come from both online submissions and internal call-based tickets, schedules may overlap or change depending on technician availability, service area, parts availability, and existing appointments.</p>
              <p>The company will do its best to accommodate the customer's preferred date, but the final service schedule will depend on confirmation from the company.</p>

              <h6>3. Payment Terms</h6>
              <p>We accept credit card payments.</p>
              <p>The customer is required to pay the diagnosis fee during the first visit. If additional repairs, parts, or labor are needed, the remaining balance will be charged on the next visit or once the service is completed.</p>

              <h6>4. Cancellation and Schedule Changes</h6>
              <p>Once a service request has been confirmed and scheduled by the company, cancellations may no longer be allowed.</p>
              <p>If the customer needs to make changes to the schedule, they must contact the company as soon as possible. Schedule changes are subject to availability and are not guaranteed.</p>

              <h6>5. Warranty</h6>
              <p>All repairs come with a 30-day warranty on parts and labor, unless otherwise stated.</p>
              <p>The warranty only applies to the repair performed by the company. It does not cover new issues, unrelated appliance problems, misuse, accidental damage, or problems caused by third-party repairs.</p>

              <h6>6. Manual Ticketing and Call Notes</h6>
              <p>When handling customer calls, authorized customer service representatives may create manual tickets or add notes to existing service requests.</p>
              <p>These notes may be used for scheduling, follow-ups, technician coordination, customer support, and service history records.</p>

              <h6>7. Call Recording Notice</h6>
              <p>Calls with customer service representatives may be automatically recorded and saved for service documentation, quality assurance, training, dispute review, and follow-up support.</p>
              <p>By using the call feature or continuing a service-related phone conversation, you acknowledge that the call may be recorded and stored as part of the service record.</p>
            </>
          ) : (
            <>
              <h6>1. Information Collection</h6>
              <p>We collect personal information that customers provide when creating an account, submitting a service request, contacting customer support, or communicating with our company.</p>
              <p>This may include the customer's name, phone number, email address, service address, appliance information, problem description, preferred service date, payment-related information, and service history.</p>

              <h6>2. How We Use Your Information</h6>
              <p>We use customer information to process service requests, schedule appointments, contact customers, assign technicians, provide updates, process payments, manage warranty or repair concerns, improve customer support, and maintain service records.</p>

              <h6>3. Data Sharing</h6>
              <p>We do not sell your personal information.</p>
              <p>We may share necessary information only when needed to provide our services. This may include sharing information with technicians, payment processors, warranty providers, customer support staff, service partners, hosting providers, email or text messaging providers, and internal systems used to manage service requests.</p>
              <p>We only share information that is needed to complete the service, process payments, communicate with customers, or comply with legal requirements.</p>

              <h6>4. Data Security</h6>
              <p>We take reasonable steps to protect customer information from unauthorized access, misuse, loss, or disclosure.</p>
              <p>Customer information may be stored in secure systems and may be protected through access controls, secure connections, passwords, and other safety measures. However, no online system can be guaranteed to be 100% secure.</p>

              <h6>5. Communication</h6>
              <p>We may contact customers by phone call, text message, or email regarding service requests, appointment updates, technician coordination, payment reminders, warranty concerns, and customer support.</p>
              <p>We may also send promotional offers or service updates. Customers may opt out of promotional messages at any time, but we may still send important service-related messages.</p>

              <h6>6. Data Retention</h6>
              <p>We keep customer information for as long as needed to provide service, maintain business records, resolve disputes, comply with legal requirements, and support future service or warranty concerns.</p>

              <h6>7. Customer Rights and Requests</h6>
              <p>Customers may contact us to request access, correction, or deletion of their personal information, subject to business, legal, or service record requirements.</p>

              <h6>8. Policy Updates</h6>
              <p>We may update this Privacy Policy from time to time. Any changes will be posted on our website or customer portal.</p>

              <h6>9. Contact Us</h6>
              <p>For questions about this Privacy Policy or how customer information is handled, please contact our company through our official support channels.</p>
            </>
          )}
        </div>
        <footer>
          <button
            onClick={() => {
              onViewed(modal);
              onClose();
            }}
            type="button"
          >
            I have reviewed this
          </button>
        </footer>
      </section>
    </div>
  );
}

export default function CustomerRegisterPage() {
  const router = useRouter();
  const { registerCustomerEmail } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [address, setAddress] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [zipStatus, setZipStatus] = useState('');
  const [zipStatusTone, setZipStatusTone] = useState<'muted' | 'success' | 'danger'>('muted');
  const [termsViewed, setTermsViewed] = useState(false);
  const [privacyViewed, setPrivacyViewed] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const strength = passwordLevel(password);
  const agreementEnabled = termsViewed && privacyViewed;
  const passwordMatch = useMemo(() => {
    if (!confirmPassword) return '';
    return password === confirmPassword ? 'match' : 'mismatch';
  }, [confirmPassword, password]);

  async function lookupZip(nextZip: string) {
    if (nextZip.length < 5) {
      setRegion('');
      setCity('');
      setState('');
      setZipStatus('');
      setZipStatusTone('muted');
      return;
    }

    setZipStatus('Checking ZIP code...');
    setZipStatusTone('muted');

    try {
      const response = await fetch(`/api/service-areas?zip=${nextZip}`);
      const data = (await response.json()) as ServiceAreaLookup;
      const match = data.service_areas?.[0];

      if (!response.ok || !match) {
        throw new Error('ZIP code is outside the current service area.');
      }

      setRegion(match.region);
      setCity(match.city);
      setState(match.state);
      setZipStatus(`Auto-filled from service area: ${match.region} > ${match.city} > ${match.state}`);
      setZipStatusTone('success');
    } catch (err) {
      setRegion('');
      setCity('');
      setState('');
      setZipStatus(err instanceof Error ? err.message : 'Could not check ZIP code. Please try again.');
      setZipStatusTone('danger');
    }
  }

  function updateZip(value: string) {
    const nextZip = value.replace(/\D/g, '').slice(0, 5);
    setZipCode(nextZip);
    void lookupZip(nextZip);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (!termsViewed) throw new Error('Please open and review the Terms and Conditions before creating your account.');
      if (!privacyViewed) throw new Error('Please open and review the Privacy Policy before creating your account.');
      if (!agreed) throw new Error('Please check the Terms and Conditions agreement box before creating your account.');
      if (password !== confirmPassword) throw new Error('Passwords do not match.');
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      if (phone.length !== 10) throw new Error('Please enter a valid 10-digit phone number.');
      if (zipCode && zipCode.length !== 5) throw new Error('Please enter a valid 5-digit ZIP code.');

      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      await registerCustomerEmail(email, password, {
        full_name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone,
        address: address.trim(),
        region,
        city,
        state,
        zip_code: zipCode,
      });
      setMessage('Customer account created. You can now log in.');
      setTimeout(() => router.push('/login'), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create customer account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="register-page-shell">
      <div className="register-container-php">
        <div className="register-card-php">
          <div className="register-header-php">
            <Wrench size={58} strokeWidth={2.5} />
            <h2>Create Account</h2>
            <p>Join Home Service to get professional appliance repair</p>
          </div>

          <form className="register-body-php" onSubmit={submit}>
            {error ? <div className="login-alert">{error}</div> : null}
            {message ? <div className="login-alert success">{message}</div> : null}

            <div className="register-grid two">
              <label>
                First Name <b>*</b>
                <input onChange={(event) => setFirstName(event.target.value)} required type="text" value={firstName} />
              </label>
              <label>
                Last Name <b>*</b>
                <input onChange={(event) => setLastName(event.target.value)} required type="text" value={lastName} />
              </label>
            </div>

            <label className="register-field">
              Email Address <b>*</b>
              <span className="register-input-icon"><Mail size={16} /><input onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></span>
            </label>

            <label className="register-field">
              Phone Number <b>*</b>
              <span className="register-input-icon"><Phone size={16} /><input onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} pattern="[0-9]{10}" placeholder="10-digit number" required type="tel" value={phone} /></span>
              <small>Enter 10-digit mobile number</small>
            </label>

            <div className="register-grid two">
              <label>
                Password <b>*</b>
                <span className="register-input-icon"><Lock size={16} /><input minLength={8} onChange={(event) => setPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} value={password} /></span>
                <i className={`password-strength ${strength}`} />
                <small>Minimum 8 characters</small>
              </label>
              <label>
                Confirm Password <b>*</b>
                <span className="register-input-icon with-toggle">
                  <Lock size={16} />
                  <input onChange={(event) => setConfirmPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} value={confirmPassword} />
                  <button aria-label="Show or hide password" onClick={() => setShowPassword((value) => !value)} type="button">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
                {passwordMatch === 'match' ? <small className="success-text">Passwords match</small> : null}
                {passwordMatch === 'mismatch' ? <small className="danger-text">Passwords do not match</small> : null}
              </label>
            </div>

            <label className="register-field">
              Service Address
              <textarea onChange={(event) => setAddress(event.target.value)} rows={2} value={address} />
            </label>

            <div className="register-grid two">
              <label>
                Region
                <input
                  className="editable-location"
                  onChange={(event) => setRegion(event.target.value)}
                  placeholder="Auto-fills from ZIP, editable"
                  value={region}
                />
              </label>
              <label>
                City
                <input
                  className="editable-location"
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Auto-fills from ZIP, editable"
                  value={city}
                />
              </label>
            </div>

            <div className="register-grid two">
              <label>
                State
                <input
                  className="editable-location"
                  onChange={(event) => setState(event.target.value)}
                  placeholder="Auto-fills from ZIP, editable"
                  value={state}
                />
              </label>
              <label>
                ZIP Code
                <input maxLength={5} onChange={(event) => updateZip(event.target.value)} pattern="\d{5}" placeholder="Enter 5-digit ZIP" value={zipCode} />
                {zipStatus ? <small className={`zip-status ${zipStatusTone}`}>{zipStatus}</small> : null}
              </label>
            </div>

            <div className="terms-check-php">
              <label>
                <input
                  checked={agreed}
                  disabled={!agreementEnabled}
                  onChange={(event) => setAgreed(event.target.checked)}
                  required
                  type="checkbox"
                />
                <span>
                  I agree to the{' '}
                  <button onClick={() => setModal('terms')} type="button">Terms and Conditions</button>{' '}
                  and{' '}
                  <button onClick={() => setModal('privacy')} type="button">Privacy Policy</button> <b>*</b>
                </span>
              </label>
              <small className={agreementEnabled ? 'success-text' : 'danger-text'}>
                {agreementEnabled ? (
                  <><CheckCircle size={13} /> Terms and Privacy Policy viewed. You may now check the agreement box.</>
                ) : (
                  <><Info size={13} /> Please open the Terms and Conditions and Privacy Policy first before checking the agreement box.</>
                )}
              </small>
            </div>

            <button className="btn-register-php" disabled={submitting} type="submit">
              <UserPlus size={16} /> {submitting ? 'Creating...' : 'Create Account'}
            </button>

            <div className="login-link-php">
              Already have an account? <Link href="/login">Login here</Link>
            </div>
          </form>
        </div>
      </div>

      <PolicyModal
        modal={modal}
        onClose={() => setModal(null)}
        onViewed={(viewed) => {
          if (viewed === 'terms') setTermsViewed(true);
          if (viewed === 'privacy') setPrivacyViewed(true);
        }}
      />
    </main>
  );
}
