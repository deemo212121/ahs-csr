'use client';

export const dynamic = 'force-dynamic';

import { AdminAnnouncementsPage } from '@/components/admin/AdminAnnouncementsPage';
import { AdminShell } from '@/components/admin/AdminShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminAnnouncementsRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Announcements">
        <AdminAnnouncementsPage />
      </AdminShell>
    </RequireAuth>
  );
}

