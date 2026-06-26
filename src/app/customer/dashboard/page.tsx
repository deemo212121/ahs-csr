'use client';

export const dynamic = 'force-dynamic';

import { CustomerDashboard } from '@/components/CustomerDashboard';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function CustomerDashboardPage() {
  return (
    <RequireAuth roles={['customer']}>
      <PortalShell title="My Dashboard">
        <CustomerDashboard />
      </PortalShell>
    </RequireAuth>
  );
}
