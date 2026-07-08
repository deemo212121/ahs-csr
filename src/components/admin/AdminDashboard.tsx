'use client';

import { Ban, BadgeCheck, Headphones } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  AdminPageHeader,
  AdminPanel,
  AdminStatGrid,
  type AdminStat,
} from '@/components/admin/AdminUi';
import {
  getTopAppliances,
  getTopBrands,
  getTopCities,
} from '@/components/admin/adminData';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import type { RtcCallListResponse } from '@/lib/calls/types';

function MetricList({ items }: { items: Array<{ label: string; value: number; helper?: string }> }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="admin-metric-list">
      {items.map((item) => (
        <div className="admin-metric-row" key={`${item.label}-${item.helper}`}>
          <div className="admin-metric-copy">
            <strong>{item.label}</strong>
            <span>{item.helper || `${item.value} requests`}</span>
          </div>
          <div className="admin-metric-visual">
            <div className="admin-metric-bar">
              <span style={{ width: `${Math.max(10, Math.round((item.value / max) * 100))}%` }} />
            </div>
            <b>{item.value}</b>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  const { requests, error } = useLeadershipRequests(500, 'view=tickets');
  // Verified/Rejected must reflect every team's verification decisions
  // company-wide, not just the live ER ticket board (which only holds
  // already-approved tickets and has no record of rejections at all).
  const { requests: allVerificationRequests, error: verificationError } = useLeadershipRequests(5000);

  // "Calls Handled" is the web-call (rtc_calls) feature, not the legacy
  // ER ticket "calls" field getAdminMetrics reads — that field is basically
  // always 0 for tickets created through the portal, which is why this tile
  // showed 0 regardless of how many web calls staff had actually answered.
  const [callsHandled, setCallsHandled] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchJsonWithFirebase<RtcCallListResponse>(user, '/api/calls?history=true&limit=2000')
      .then((data) => {
        if (cancelled || data.setup_required) return;
        setCallsHandled(data.calls.filter((call) => call.status === 'completed').length);
      })
      .catch(() => {
        // Leave the count at 0 rather than breaking the rest of the dashboard.
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const topCities = useMemo(() => getTopCities(requests), [requests]);
  const topBrands = useMemo(() => getTopBrands(requests), [requests]);
  const topAppliances = useMemo(() => getTopAppliances(requests), [requests]);

  const verifiedTotal = useMemo(
    () => allVerificationRequests.filter((request) => request.verification_status === 'approved').length,
    [allVerificationRequests],
  );
  const rejectedTotal = useMemo(
    () => allVerificationRequests.filter((request) => request.verification_status === 'rejected').length,
    [allVerificationRequests],
  );

  const totals: AdminStat[] = [
    { label: 'Verified', value: verifiedTotal, tone: 'green', icon: <BadgeCheck size={17} /> },
    { label: 'Rejected', value: rejectedTotal, tone: 'red', icon: <Ban size={17} /> },
    { label: 'Calls Handled', value: callsHandled, tone: 'cyan', icon: <Headphones size={17} /> },
  ];

  return (
    <div className="admin-dashboard">
      <AdminPageHeader
        description="Live overview based on the ER tickets table."
        eyebrow="Administrator overview"
        title="Status Summary"
      />

      {error ? <div className="customer-alert">{error}</div> : null}
      {verificationError ? <div className="customer-alert">{verificationError}</div> : null}

      <AdminPanel subtitle="Verified, rejected, and calls handled across all tickets" title="Total">
        <AdminStatGrid stats={totals} />
      </AdminPanel>

      <div className="admin-grid-3">
        <AdminPanel subtitle="Most common brands" title="Top Brands">
          <MetricList items={topBrands} />
        </AdminPanel>
        <AdminPanel subtitle="Top request locations" title="Top Cities">
          <MetricList items={topCities} />
        </AdminPanel>
        <AdminPanel subtitle="Most requested product types" title="Top Appliances">
          <MetricList items={topAppliances} />
        </AdminPanel>
      </div>
    </div>
  );
}
