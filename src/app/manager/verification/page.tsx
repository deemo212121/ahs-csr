'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { VerificationQueue } from '@/components/VerificationQueue';

export default function ManagerVerificationRoutePage() {
  return (
    <RequireAuth roles={['csr_manager', 'admin']}>
      <PortalShell title="Verification Queue">
        <VerificationQueue />
      </PortalShell>
    </RequireAuth>
  );
}

