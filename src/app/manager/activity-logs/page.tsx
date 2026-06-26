'use client';

export const dynamic = 'force-dynamic';

import { AdminCatalogPage } from '@/components/admin/AdminCatalogPage';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function ManagerActivityLogsPage() {
  return (
    <RequireAuth roles={['csr_manager', 'admin']}>
      <PortalShell title="Activity Logs">
        <AdminCatalogPage mode="activity-logs" />
      </PortalShell>
    </RequireAuth>
  );
}
