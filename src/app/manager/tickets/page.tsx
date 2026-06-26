'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { TicketsPage } from '@/components/TicketsPage';

export default function ManagerTicketsRoutePage() {
  return (
    <RequireAuth roles={['csr_manager', 'admin']}>
      <PortalShell title="Tickets">
        <TicketsPage />
      </PortalShell>
    </RequireAuth>
  );
}

