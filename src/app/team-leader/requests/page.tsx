'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { TeamRequestsPage } from '@/components/leadership/TeamRequestsPage';

export default function TeamLeaderRequestsRoutePage() {
  return (
    <RequireAuth roles={['team_leader']}>
      <PortalShell title="Team Requests">
        <TeamRequestsPage />
      </PortalShell>
    </RequireAuth>
  );
}

