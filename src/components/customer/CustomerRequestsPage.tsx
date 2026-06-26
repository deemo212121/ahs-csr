'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CustomerRequestCards } from '@/components/customer/CustomerRequestCards';
import { useCustomerRequests } from '@/components/customer/useCustomerRequests';
import type { ServiceRequest } from '@/lib/types';

type FilterStatus = 'all' | 'new' | 'assigned' | 'in-progress' | 'completed' | 'cancelled';

const statusFilters: Array<{ value: FilterStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New Request' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Repair Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function visibleStatus(request: ServiceRequest) {
  const job = (request.job_status?.status_name || '').toLowerCase();
  if (job.includes('complete')) return 'completed';
  if (job.includes('progress')) return 'in-progress';
  if (job.includes('assign')) return 'assigned';
  if (job.includes('cancel')) return 'cancelled';
  if (request.verification_status === 'rejected') return 'cancelled';
  if (request.verification_status === 'approved') return 'assigned';
  return 'new';
}

export function CustomerRequestsPage() {
  const { requests, loading, error, refresh } = useCustomerRequests(150);
  const [status, setStatus] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    return {
      total: requests.length,
      newRequests: requests.filter((request) => visibleStatus(request) === 'new').length,
      inProgress: requests.filter((request) => visibleStatus(request) === 'in-progress').length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return requests.filter((request) => {
      const currentStatus = visibleStatus(request);
      const matchesStatus = status === 'all' || status === currentStatus;
      const haystack = [
        request.request_number,
        request.manual_brand,
        request.brand?.name,
        request.manual_appliance_type,
        request.appliance_type?.name,
        request.model_number,
        request.serial_number,
        request.issue_description,
        request.service_address,
        request.city,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [requests, search, status]);

  return (
    <div className="customer-page-shell cx-my-requests-page">
      <section className="cx-my-request-stats">
        <div><strong>{stats.total}</strong><span>Total</span></div>
        <div><strong>{stats.newRequests}</strong><span>New Request</span></div>
        <div><strong>{stats.inProgress}</strong><span>In Progress</span></div>
      </section>

      <section className="customer-filter-panel cx-request-filter-panel">
        <div className="customer-search">
          <Search size={17} />
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search requests..."
            value={search}
          />
        </div>
        <div className="customer-filter-chips">
          {statusFilters.map((item) => (
            <button
              className={status === item.value ? 'active' : ''}
              key={item.value}
              onClick={() => setStatus(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
          <button onClick={refresh} type="button">Refresh</button>
        </div>
      </section>

      {error ? <div className="customer-alert">{error}</div> : null}
      <CustomerRequestCards loading={loading} requests={filteredRequests} />
    </div>
  );
}
