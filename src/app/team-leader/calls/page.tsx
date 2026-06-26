'use client';

export const dynamic = 'force-dynamic';

import { TeamLeaderCallsPage } from '@/components/leadership/TeamLeaderCallsPage';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function TeamLeaderCallsRoutePage() {
  return (
    <RequireAuth roles={['team_leader']}>
      <PortalShell title="Call Queue">
        <TeamLeaderCallsPage />
      </PortalShell>
    </RequireAuth>
  );
}
