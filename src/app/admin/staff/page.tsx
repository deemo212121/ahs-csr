'use client';

export const dynamic = 'force-dynamic';

import { AdminShell } from '@/components/admin/AdminShell';
import { AdminStaffPage } from '@/components/admin/AdminStaffPage';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminStaffRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Staff Management">
        <AdminStaffPage />
      </AdminShell>
    </RequireAuth>
  );
}

