'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { VerificationQueue } from '@/components/VerificationQueue';

export default function TeamLeaderVerificationRoutePage() {
  return (
    <RequireAuth roles={['team_leader']}>
      <PortalShell title="Verification">
        <VerificationQueue />
      </PortalShell>
    </RequireAuth>
  );
}

