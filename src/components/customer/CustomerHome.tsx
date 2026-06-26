'use client';

import Link from 'next/link';
import {
  CalendarDays,
  ClipboardList,
  Mail,
  MessageSquare,
  Phone,
  PlusCircle,
  UserRound,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useCustomerRequests } from '@/components/customer/useCustomerRequests';

const services = ['Washer/Dryer Combo', 'Wine Cooler', 'Wall Oven', 'TV', 'Range Hood', 'Range'];

function statusLabel(status?: string | null, verification?: string | null) {
  if (status) return status;
  if (verification === 'rejected') return 'Cancelled';
  if (verification === 'approved') return 'Assigned';
  return 'New Request';
}

function formatDate(value?: string | null) {
  if (!value) return 'No date yet';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMemberSince(value?: string | null) {
  const fallback = new Date();
  const parsed = value ? new Date(value) : fallback;
  const date = Number.isNaN(parsed.getTime()) || parsed.getFullYear() < 2020 ? fallback : parsed;
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function requestTitle(request: { manual_appliance_type?: string | null; appliance_type?: { name: string | null } | null }) {
  return `${request.appliance_type?.name || request.manual_appliance_type || 'Appliance'} Service`;
}

export function CustomerHome() {
  const { profile } = useAuth();
  const { requests, loading, error } = useCustomerRequests(80);
  const total = requests.length;
  const newRequests = requests.filter((request) => request.verification_status === 'pending').length;
  const scheduled = requests.filter((request) => (request.job_status?.status_name || '').toLowerCase().includes('schedule')).length;
  const completed = requests.filter((request) => (request.job_status?.status_name || '').toLowerCase().includes('complete')).length;
  const recentRequests = requests.slice(0, 5);
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Customer';

  return (
    <div className="customer-page-shell customer-home-shell">
      <section className="cx-welcome-panel">
        <div className="cx-welcome-profile">
          <img alt="US In Home Services" src="/ushs_logo.png" />
          <div>
            <h1>Welcome back, {profile?.first_name || fullName}!</h1>
            <p>
              <Mail size={15} />
              {profile?.email || 'No email on file'}
            </p>
            <p>
              <Phone size={15} />
              {profile?.phone_number || 'No phone on file'}
            </p>
            <p>
              <CalendarDays size={15} />
              Member since {formatMemberSince(profile?.created_at)}
            </p>
          </div>
        </div>
        <div className="cx-hero-question">What appliance can we fix for you today?</div>
        <div className="cx-primary-actions">
          <Link className="cx-action-btn light" href="/customer/request">
            <PlusCircle size={18} />
            Request Repair Service
          </Link>
          <Link className="cx-action-btn blue" href="/customer/calls">
            <Phone size={18} />
            Request a Call
          </Link>
        </div>
      </section>

      <section className="cx-stat-grid">
        <div className="cx-stat-card"><strong>{total}</strong><span>Total</span></div>
        <div className="cx-stat-card"><strong>{newRequests}</strong><span>New Request</span></div>
        <div className="cx-stat-card"><strong>{scheduled}</strong><span>Scheduled</span></div>
        <div className="cx-stat-card"><strong>{completed}</strong><span>Repair Completed</span></div>
      </section>

      <section className="cx-shortcut-grid">
        <Link href="/customer/request"><PlusCircle size={22} /><span>New Request</span></Link>
        <Link href="/customer/requests"><ClipboardList size={22} /><span>My Requests</span></Link>
        <Link href="/customer/messages"><MessageSquare size={22} /><span>Messages</span></Link>
        <Link href="/customer/profile"><UserRound size={22} /><span>Profile</span></Link>
      </section>

      <section className="cx-section-block">
        <div className="cx-section-title"><h2>Our Services</h2><Link href="/customer/request">View All ›</Link></div>
        <div className="cx-service-grid">
          {services.map((service) => (
            <Link className="cx-service-card" href={`/customer/request?service=${encodeURIComponent(service)}`} key={service}>
              <span><Wrench size={22} /></span>
              <strong>{service}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="cx-section-block">
        <div className="cx-section-title"><h2>Recent Requests</h2><Link href="/customer/requests">View All ›</Link></div>
        {error ? <div className="customer-alert">{error}</div> : null}
        <div className="cx-recent-list">
          {loading ? <div className="cx-empty-row">Loading requests...</div> : null}
          {!loading && !recentRequests.length ? <div className="cx-empty-row">No recent requests yet.</div> : null}
          {recentRequests.map((request) => (
            <article className="cx-recent-card" key={request.id}>
              <span className="cx-service-icon"><Wrench size={21} /></span>
              <div>
                <strong>{requestTitle(request)}</strong>
                <small><CalendarDays size={13} /> {formatDate(request.preferred_date || request.requested_at)}</small>
              </div>
              <span className={`cx-status-pill ${statusLabel(request.job_status?.status_name, request.verification_status).toLowerCase().replace(/\s+/g, '-')}`}>
                {statusLabel(request.job_status?.status_name, request.verification_status)}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
