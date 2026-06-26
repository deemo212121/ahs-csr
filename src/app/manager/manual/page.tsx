'use client';

export const dynamic = 'force-dynamic';

import { ClipboardPlus } from 'lucide-react';
import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { ServiceRequestForm } from '@/components/ServiceRequestForm';

export default function ManagerManualTicketRoutePage() {
  return (
    <RequireAuth roles={['csr_manager', 'admin']}>
      <PortalShell title="Manual Ticket">
        <div className="manager-dashboard php-manager-page manager-manual-page">
          <section className="manager-page-title-row manual">
            <div>
              <h1><ClipboardPlus size={38} /> Manual Ticket Entry</h1>
              <p>For CSR phone calls. Enter the customer and product details, then submit the ticket into the request queue.</p>
            </div>
          </section>
          <section className="manager-manual-form-panel">
            <ServiceRequestForm />
          </section>
        </div>
      </PortalShell>
    </RequireAuth>
  );
}
