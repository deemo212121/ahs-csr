'use client';

export const dynamic = 'force-dynamic';

import { AdminCitiesPage } from '@/components/admin/AdminCitiesPage';
import { AdminShell } from '@/components/admin/AdminShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminCitiesRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Cities">
        <AdminCitiesPage />
      </AdminShell>
    </RequireAuth>
  );
}
