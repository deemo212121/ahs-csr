'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import type { ServiceRequest } from '@/lib/types';

export function useLeadershipRequests(limit = 150, params = '') {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const suffix = params ? `&${params}` : '';
      const data = await fetchJsonWithFirebase<{ requests: ServiceRequest[] }>(
        user,
        `/api/service-requests?limit=${limit}${suffix}`,
      );
      setRequests(data.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load requests.');
    } finally {
      setLoading(false);
    }
  }, [limit, params, user]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    requests,
    loading,
    error,
    refresh: load,
  };
}

