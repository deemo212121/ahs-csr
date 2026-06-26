'use client';

import { useEffect, useState } from 'react';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import { useAuth } from '@/components/AuthProvider';
import { RequestTable } from '@/components/RequestTable';
import { StatGrid } from '@/components/StatGrid';
import type { ServiceRequest } from '@/lib/types';

export function DashboardOverview({ title }: { title: string }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJsonWithFirebase<{ requests: ServiceRequest[] }>(
        user,
        '/api/service-requests?limit=80',
      );
      setRequests(data.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [user]);

  const pending = requests.filter((request) => request.verification_status === 'pending').length;
  const approved = requests.filter((request) => request.verification_status === 'approved').length;
  const rejected = requests.filter((request) => request.verification_status === 'rejected').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="muted">Service request activity</p>
        </div>
      </div>
      <StatGrid pending={pending} approved={approved} rejected={rejected} calls={0} />
      {error ? <p className="error">{error}</p> : null}
      <RequestTable requests={requests.slice(0, 12)} loading={loading} onRefresh={load} />
    </>
  );
}
