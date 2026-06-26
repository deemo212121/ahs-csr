'use client';

export const dynamic = 'force-dynamic';

import { CallsPage } from '@/components/CallsPage';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function CsrCallsPage() {
  return (
    <RequireAuth roles={['csr', 'team_leader', 'csr_manager', 'admin']}>
      <PortalShell title="Calls">
        <CallsPage />
      </PortalShell>
    </RequireAuth>
  );
}
