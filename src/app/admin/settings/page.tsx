'use client';

export const dynamic = 'force-dynamic';

import { AdminSettingsPage } from '@/components/admin/AdminSettingsPage';
import { AdminShell } from '@/components/admin/AdminShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminSettingsRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Settings">
        <AdminSettingsPage />
      </AdminShell>
    </RequireAuth>
  );
}
