'use client';

export const dynamic = 'force-dynamic';

import { AdminRequestsPage } from '@/components/admin/AdminRequestsPage';
import { AdminShell } from '@/components/admin/AdminShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminRequestsRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Requests">
        <AdminRequestsPage />
      </AdminShell>
    </RequireAuth>
  );
}

