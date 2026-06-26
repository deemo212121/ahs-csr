'use client';

export const dynamic = 'force-dynamic';

import { CustomerMessagesPage } from '@/components/customer/CustomerMessagesPage';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';

export default function CustomerMessagesRoute() {
  return (
    <RequireAuth roles={['customer']}>
      <PortalShell title="Messages">
        <CustomerMessagesPage />
      </PortalShell>
    </RequireAuth>
  );
}
