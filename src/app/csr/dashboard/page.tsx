'use client';

export const dynamic = 'force-dynamic';

import { CsrDashboard } from '@/components/csr/CsrDashboard';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function CsrDashboardPage() {
  return (
    <RequireAuth roles={['csr']}>
      <PortalShell title="Dashboard">
        <CsrDashboard />
      </PortalShell>
    </RequireAuth>
  );
}
