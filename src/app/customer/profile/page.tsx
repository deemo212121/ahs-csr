'use client';

export const dynamic = 'force-dynamic';

import { CustomerProfilePage } from '@/components/customer/CustomerProfilePage';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function CustomerProfileRoute() {
  return (
    <RequireAuth roles={['customer']}>
      <PortalShell title="My Profile">
        <CustomerProfilePage />
      </PortalShell>
    </RequireAuth>
  );
}
