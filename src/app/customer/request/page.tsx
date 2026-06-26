'use client';

export const dynamic = 'force-dynamic';

import { CustomerRequestPage } from '@/components/customer/CustomerRequestPage';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function CustomerRequestRoute() {
  return (
    <RequireAuth roles={['customer']}>
      <PortalShell title="Request Service">
        <CustomerRequestPage />
      </PortalShell>
    </RequireAuth>
  );
}
