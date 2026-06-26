'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { ManagerPlaceholderPage } from '@/components/leadership/ManagerPlaceholderPage';

export default function ManagerMistakePage() {
  return (
    <RequireAuth roles={['csr_manager', 'admin']}>
      <PortalShell title="Mistake">
        <ManagerPlaceholderPage title="Mistake" description="View, filter, and record CSR mistakes for coaching and reporting." icon="mistake" />
      </PortalShell>
    </RequireAuth>
  );
}
