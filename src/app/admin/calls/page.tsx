'use client';

export const dynamic = 'force-dynamic';

import { AdminShell } from '@/components/admin/AdminShell';
import { CallsPage } from '@/components/CallsPage';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminCallsRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Calls">
        <CallsPage />
      </AdminShell>
    </RequireAuth>
  );
}
