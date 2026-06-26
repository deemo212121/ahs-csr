'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { InternalMessagesPage } from '@/components/leadership/InternalMessagesPage';

export default function ManagerMessagesRoutePage() {
  return (
    <RequireAuth roles={['csr_manager', 'admin']}>
      <PortalShell title="Messages">
        <InternalMessagesPage
          description="Manager follow-up, dispatch updates, and verification coordination."
          title="Messages"
        />
      </PortalShell>
    </RequireAuth>
  );
}

