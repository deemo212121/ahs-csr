'use client';

export const dynamic = 'force-dynamic';

import { CustomerNotificationsPage } from '@/components/customer/CustomerNotificationsPage';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function CustomerNotificationsRoute() {
  return (
    <RequireAuth roles={['customer']}>
      <PortalShell title="Notifications">
        <CustomerNotificationsPage />
      </PortalShell>
    </RequireAuth>
  );
}
