'use client';

export const dynamic = 'force-dynamic';

import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminShell } from '@/components/admin/AdminShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminDashboardPage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Admin Dashboard">
        <AdminDashboard />
      </AdminShell>
    </RequireAuth>
  );
}
