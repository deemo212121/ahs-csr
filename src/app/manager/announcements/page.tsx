'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { ManagerPlaceholderPage } from '@/components/leadership/ManagerPlaceholderPage';

export default function ManagerAnnouncementsPage() {
  return (
    <RequireAuth roles={['csr_manager', 'admin']}>
      <PortalShell title="Announcements">
        <ManagerPlaceholderPage title="Announcements" description="Post or review manager-level announcements for teams and agents." icon="announcements" />
      </PortalShell>
    </RequireAuth>
  );
}
