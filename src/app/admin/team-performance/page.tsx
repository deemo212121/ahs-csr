'use client';

export const dynamic = 'force-dynamic';

import { AdminShell } from '@/components/admin/AdminShell';
import { ManagerTeamPerformanceDashboard } from '@/components/leadership/ManagerTeamPerformanceDashboard';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminTeamPerformanceRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="All Team Performance">
        <ManagerTeamPerformanceDashboard />
      </AdminShell>
    </RequireAuth>
  );
}
