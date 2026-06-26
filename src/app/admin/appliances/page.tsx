'use client';

export const dynamic = 'force-dynamic';

import { AdminCatalogPage } from '@/components/admin/AdminCatalogPage';
import { AdminShell } from '@/components/admin/AdminShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminAppliancesRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Appliances">
        <AdminCatalogPage mode="appliances" />
      </AdminShell>
    </RequireAuth>
  );
}

