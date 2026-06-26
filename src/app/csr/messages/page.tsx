'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { InternalMessagesPage } from '@/components/leadership/InternalMessagesPage';

export default function CsrMessagesRoutePage() {
  return (
    <RequireAuth roles={['csr', 'team_leader', 'csr_manager', 'admin']}>
      <PortalShell title="Messages">
        <InternalMessagesPage
          description="Customer ticket conversations and support follow-ups."
          title="Messages"
        />
      </PortalShell>
    </RequireAuth>
  );
}
