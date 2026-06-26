'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { ManagerPlaceholderPage } from '@/components/leadership/ManagerPlaceholderPage';

export default function ManagerBranchAssignmentPage() {
  return (
    <RequireAuth roles={['csr_manager', 'admin']}>
      <PortalShell title="Branch Assignment">
        <ManagerPlaceholderPage title="Branch Assignment" description="Manage which teams and agents are assigned to each service branch." icon="branch" />
      </PortalShell>
    </RequireAuth>
  );
}
