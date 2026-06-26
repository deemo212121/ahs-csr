'use client';

export const dynamic = 'force-dynamic';

import { CallsPage } from '@/components/CallsPage';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function CallsRoutePage() {
  return (
    <RequireAuth roles={['csr_manager', 'admin']}>
      <PortalShell title="Call Queue">
        <CallsPage />
      </PortalShell>
    </RequireAuth>
  );
}
