'use client';

export const dynamic = 'force-dynamic';

import { use } from 'react';
import { RegisterPageContent } from '@/components/RegisterPageContent';

export default function CompanyCustomerRegisterPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  return <RegisterPageContent companySlug={companyId} />;
}
