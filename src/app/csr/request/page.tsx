'use client';

export const dynamic = 'force-dynamic';

import { CsrTicketsPage } from '@/components/csr/CsrTicketsPage';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function CsrRequestPage() {
  return (
    <RequireAuth roles={['csr', 'team_leader', 'csr_manager', 'admin']}>
      <PortalShell title="Tickets">
        <CsrTicketsPage />
      </PortalShell>
    </RequireAuth>
  );
}
