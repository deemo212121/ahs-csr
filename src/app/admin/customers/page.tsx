'use client';

export const dynamic = 'force-dynamic';

import { AdminCatalogPage } from '@/components/admin/AdminCatalogPage';
import { AdminShell } from '@/components/admin/AdminShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function AdminCustomersRoutePage() {
  return (
    <RequireAuth roles={['admin']}>
      <AdminShell title="Customers">
        <AdminCatalogPage mode="customers" />
      </AdminShell>
    </RequireAuth>
  );
}

