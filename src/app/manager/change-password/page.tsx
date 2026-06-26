'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { ManagerPlaceholderPage } from '@/components/leadership/ManagerPlaceholderPage';

export default function ManagerChangePasswordPage() {
  return (
    <RequireAuth roles={['csr_manager', 'admin']}>
      <PortalShell title="Change Password">
        <ManagerPlaceholderPage title="Change Password" description="Update the Firebase staff password for this manager account." icon="password" />
      </PortalShell>
    </RequireAuth>
  );
}
