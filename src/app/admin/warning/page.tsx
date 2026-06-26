'use client';

export const dynamic = 'force-dynamic';

import { AdminDisciplinePage } from '@/components/admin/AdminDisciplinePage';
import { AdminShell } from '@/components/admin/AdminShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminWarningRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Warning">
        <AdminDisciplinePage kind="warning" />
      </AdminShell>
    </RequireAuth>
  );
}

