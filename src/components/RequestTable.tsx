'use client';

import { RefreshCw } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { ServiceRequest } from '@/lib/types';

export function RequestTable({
  requests,
  loading,
  onRefresh,
  actions,
}: {
  requests: ServiceRequest[];
  loading?: boolean;
  onRefresh?: () => void;
  actions?: (request: ServiceRequest) => React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <strong>Requests</strong>
        {onRefresh ? (
          <button className="btn btn-secondary" onClick={onRefresh} type="button">
            <RefreshCw size={16} />
            Refresh
          </button>
        ) : null}
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Request #</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Address</th>
              <th>Status</th>
              <th>Requested</th>
              {actions ? <th>Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>
                  <strong>{request.request_number}</strong>
                  <br />
                  <span className="muted">{request.sync_status}</span>
                </td>
                <td>
                  <strong>{request.full_name}</strong>
                  <br />
                  <span className="muted">{request.phone_number}</span>
                </td>
                <td>
                  {request.manual_brand || 'Unspecified'}
                  <br />
                  <span className="muted">{request.manual_appliance_type || request.model_number || '-'}</span>
                </td>
                <td>
                  {request.service_address}
                  <br />
                  <span className="muted">
                    {[request.region, request.state, request.zip_code].filter(Boolean).join(', ')}
                  </span>
                </td>
                <td>
                  <StatusBadge status={request.verification_status} />
                </td>
                <td>{new Date(request.requested_at).toLocaleString()}</td>
                {actions ? <td>{actions(request)}</td> : null}
              </tr>
            ))}
            {!requests.length ? (
              <tr>
                <td colSpan={actions ? 7 : 6}>{loading ? 'Loading...' : 'No requests found.'}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
