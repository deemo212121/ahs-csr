'use client';

export const dynamic = 'force-dynamic';

import { TeamManualTicketPage } from '@/components/leadership/TeamManualTicketPage';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function CsrManualPage() {
  return (
    <RequireAuth roles={['csr', 'team_leader', 'csr_manager', 'admin']}>
      <PortalShell title="Manual">
        <TeamManualTicketPage />
      </PortalShell>
    </RequireAuth>
  );
}
