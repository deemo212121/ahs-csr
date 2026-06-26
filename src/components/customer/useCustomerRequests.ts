'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import { useAuth } from '@/components/AuthProvider';
import type { ServiceRequest } from '@/lib/types';

export function useCustomerRequests(limit = 80) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchJsonWithFirebase<{ requests: ServiceRequest[] }>(
        user,
        `/api/service-requests?limit=${limit}`,
      );
      setRequests(data.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load customer requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [limit, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { requests, loading, error, refresh };
}
