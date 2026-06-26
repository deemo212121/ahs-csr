import { RequireAuth } from '@/components/RequireAuth';
import { PortalShell } from '@/components/PortalShell';
import { CustomerCallsPage } from '@/components/customer/CustomerCallsPage';

export default function CustomerCallsRoutePage() {
  return (
    <RequireAuth roles={['customer']}>
      <PortalShell title="Web Call">
        <CustomerCallsPage />
      </PortalShell>
    </RequireAuth>
  );
}
