'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { ManagerReportPage } from '@/components/leadership/ManagerReportPage';

export default function ManagerReportRoutePage() {
  return (
    <RequireAuth roles={['csr_manager', 'admin']}>
      <PortalShell title="CSR Daily Report">
        <ManagerReportPage />
      </PortalShell>
    </RequireAuth>
  );
}

