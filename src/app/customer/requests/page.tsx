'use client';

export const dynamic = 'force-dynamic';

import { CustomerRequestsPage } from '@/components/customer/CustomerRequestsPage';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function CustomerRequestsRoute() {
  return (
    <RequireAuth roles={['customer']}>
      <PortalShell title="My Requests">
        <CustomerRequestsPage />
      </PortalShell>
    </RequireAuth>
  );
}
