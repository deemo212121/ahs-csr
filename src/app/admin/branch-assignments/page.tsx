'use client';

export const dynamic = 'force-dynamic';

import { AdminBranchAssignmentsPage } from '@/components/admin/AdminBranchAssignmentsPage';
import { AdminShell } from '@/components/admin/AdminShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminBranchAssignmentsRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Branch Assignment">
        <AdminBranchAssignmentsPage />
      </AdminShell>
    </RequireAuth>
  );
}

