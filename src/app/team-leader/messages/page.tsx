'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { InternalMessagesPage } from '@/components/leadership/InternalMessagesPage';

export default function TeamLeaderMessagesRoutePage() {
  return (
    <RequireAuth roles={['team_leader']}>
      <PortalShell title="Messages">
        <InternalMessagesPage
          description="Internal team coordination and follow-up threads."
          title="Messages"
        />
      </PortalShell>
    </RequireAuth>
  );
}

