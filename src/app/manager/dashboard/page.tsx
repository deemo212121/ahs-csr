'use client';

export const dynamic = 'force-dynamic';

import { ManagerDashboard } from '@/components/leadership/ManagerDashboard';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function ManagerDashboardPage() {
  return (
    <RequireAuth roles={['csr_manager']}>
      <PortalShell title="CSR Dashboard">
        <ManagerDashboard />
      </PortalShell>
    </RequireAuth>
  );
}
