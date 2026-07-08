'use client';

export const dynamic = 'force-dynamic';

import { AdminFilterManagementPage } from '@/components/admin/AdminFilterManagementPage';
import { AdminShell } from '@/components/admin/AdminShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminFilterManagementRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Filter Management">
        <AdminFilterManagementPage />
      </AdminShell>
    </RequireAuth>
  );
}
