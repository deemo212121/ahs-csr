'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import type { AppRole } from '@/lib/types';

export function RequireAuth({
  roles,
  children,
}: {
  roles?: AppRole[];
  children: React.ReactNode;
}) {
  const { user, role, home, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (roles && role && !roles.includes(role)) {
      router.replace(home ?? '/login');
    }
  }, [loading, user, role, roles, home, router]);

  if (loading) {
    return <div className="page">Loading...</div>;
  }

  if (!user || (roles && role && !roles.includes(role))) {
    return <div className="page">Redirecting...</div>;
  }

  return <>{children}</>;
}
