'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { TeamPerformancePage } from '@/components/leadership/TeamPerformancePage';

export default function TeamLeaderPerformanceRoutePage() {
  return (
    <RequireAuth roles={['team_leader']}>
      <PortalShell title="Performance">
        <TeamPerformancePage />
      </PortalShell>
    </RequireAuth>
  );
}

