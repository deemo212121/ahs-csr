'use client';

import Link from 'next/link';
import { Bell, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { useCustomerRequests } from '@/components/customer/useCustomerRequests';

export function CustomerNotificationsPage() {
  const { requests, loading, error } = useCustomerRequests(100);

  const notifications = useMemo(
    () =>
      requests.slice(0, 12).map((request) => {
        if (request.verification_status === 'approved') {
          return {
            icon: <CheckCircle2 size={18} />,
            title: `${request.request_number} approved`,
            message: 'Your request has been approved for ticket handling.',
            href: `/customer/messages?request=${request.id}`,
          };
        }

        if (request.verification_status === 'rejected') {
          return {
            icon: <XCircle size={18} />,
            title: `${request.request_number} needs review`,
            message: request.verification_reject_reason || 'Your request was not approved.',
            href: '/customer/requests',
          };
        }

        return {
          icon: <Clock3 size={18} />,
          title: `${request.request_number} is pending`,
          message: 'Your request is waiting for verification.',
          href: '/customer/requests',
        };
      }),
    [requests],
  );

  return (
    <div className="customer-page-shell">
      <div className="customer-section-head">
        <div>
          <h1>Notifications</h1>
          <p>Request updates from your account.</p>
        </div>
      </div>
      {error ? <div className="customer-alert">{error}</div> : null}
      <section className="customer-notification-list">
        {notifications.map((notification) => (
          <Link className="customer-notification-card" href={notification.href} key={notification.title}>
            <span>{notification.icon}</span>
            <div>
              <strong>{notification.title}</strong>
              <p>{notification.message}</p>
            </div>
          </Link>
        ))}
        {!notifications.length ? (
          <div className="customer-empty">
            <Bell size={34} />
            <strong>{loading ? 'Loading notifications...' : 'No notifications yet.'}</strong>
          </div>
        ) : null}
      </section>
    </div>
  );
}
