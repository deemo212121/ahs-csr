'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { VerificationQueue } from '@/components/VerificationQueue';

export default function VerificationPage() {
  return (
    <RequireAuth roles={['csr', 'team_leader', 'csr_manager', 'admin']}>
      <PortalShell title="Verification">
        <VerificationQueue />
      </PortalShell>
    </RequireAuth>
  );
}
