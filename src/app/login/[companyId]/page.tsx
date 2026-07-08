'use client';

export const dynamic = 'force-dynamic';

import { use } from 'react';
import { LoginPageContent } from '@/components/LoginPageContent';

export default function CompanyLoginPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  return <LoginPageContent companySlug={companyId} />;
}
