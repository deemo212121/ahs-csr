'use client';

export const dynamic = 'force-dynamic';

import { AdminDisciplinePage } from '@/components/admin/AdminDisciplinePage';
import { AdminShell } from '@/components/admin/AdminShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminMistakeRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Mistake">
        <AdminDisciplinePage kind="mistake" />
      </AdminShell>
    </RequireAuth>
  );
}

