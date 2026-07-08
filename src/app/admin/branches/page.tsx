'use client';

export const dynamic = 'force-dynamic';

import { AdminBranchesPage } from '@/components/admin/AdminBranchesPage';
import { AdminShell } from '@/components/admin/AdminShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminBranchesRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Branches">
        <AdminBranchesPage />
      </AdminShell>
    </RequireAuth>
  );
}
