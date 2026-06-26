'use client';

export const dynamic = 'force-dynamic';

import { TeamLeaderDashboard } from '@/components/leadership/TeamLeaderDashboard';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function TeamLeaderDashboardPage() {
  return (
    <RequireAuth roles={['team_leader']}>
      <PortalShell title="Team Leader">
        <TeamLeaderDashboard />
      </PortalShell>
    </RequireAuth>
  );
}
