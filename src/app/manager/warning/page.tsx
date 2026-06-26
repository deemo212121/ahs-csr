'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { ManagerPlaceholderPage } from '@/components/leadership/ManagerPlaceholderPage';

export default function ManagerWarningPage() {
  return (
    <RequireAuth roles={['csr_manager', 'admin']}>
      <PortalShell title="Warning">
        <ManagerPlaceholderPage title="Warning" description="Review warning records and follow up with CSR agents or team leaders." icon="warning" />
      </PortalShell>
    </RequireAuth>
  );
}
