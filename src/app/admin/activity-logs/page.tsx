'use client';

export const dynamic = 'force-dynamic';

import { AdminCatalogPage } from '@/components/admin/AdminCatalogPage';
import { AdminShell } from '@/components/admin/AdminShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminActivityLogsRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Activity Logs">
        <AdminCatalogPage mode="activity-logs" />
      </AdminShell>
    </RequireAuth>
  );
}

