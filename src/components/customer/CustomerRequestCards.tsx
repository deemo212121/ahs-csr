'use client';

import Link from 'next/link';
import { CalendarDays, ChevronRight, Mail, MapPin, MessageSquare, PackageSearch, Tag, Wrench, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ServiceRequest } from '@/lib/types';

type DetailSection = {
  title: string;
  rows: Array<[string, string | number | null | undefined]>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function valueOrDash(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function productLabel(request: ServiceRequest) {
  return `${request.appliance_type?.name || request.manual_appliance_type || 'Appliance'} Service`;
}

function brandLabel(request: ServiceRequest) {
  return request.brand?.name || request.manual_brand || 'Brand pending';
}

function statusLabel(request: ServiceRequest) {
  if (request.job_status?.status_name) return request.job_status.status_name;
  if (request.verification_status === 'rejected') return 'Cancelled';
  if (request.verification_status === 'approved') return 'Assigned';
  return 'New Request';
}

function statusClass(label: string) {
  return label.toLowerCase().replace(/\s+/g, '-');
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="er-ticket-detail-row">
      <span>{label}</span>
      <strong>{valueOrDash(value)}</strong>
    </div>
  );
}

function CustomerRequestDetailModal({
  request,
  onClose,
}: {
  request: ServiceRequest;
  onClose: () => void;
}) {
  const label = statusLabel(request);
  const sections = useMemo<DetailSection[]>(() => ([
    {
      title: 'Request Summary',
      rows: [
        ['Request Number', request.request_number],
        ['Current Status', label],
        ['Verification Status', request.verification_status],
        ['ER Ticket ID', request.er_ticket_id || request.er_ticket?.ticket_no],
        ['Submitted At', formatDateTime(request.requested_at)],
        ['Last Updated', formatDateTime(request.updated_at)],
      ],
    },
    {
      title: 'Customer Information',
      rows: [
        ['Customer Name', request.full_name],
        ['Phone Number', request.phone_number],
        ['Secondary Phone', request.secondary_phone],
        ['Email', request.customer_email],
      ],
    },
    {
      title: 'Service Address',
      rows: [
        ['Address', request.service_address],
        ['Address Line 2', request.service_address_2],
        ['City', request.city],
        ['Region / Branch', request.region],
        ['State', request.state],
        ['ZIP Code', request.zip_code],
        ['Landmark / Notes', request.landmark],
      ],
    },
    {
      title: 'Appliance / Product Details',
      rows: [
        ['Appliance', request.appliance_type?.name || request.manual_appliance_type],
        ['Brand', request.brand?.name || request.manual_brand],
        ['Model Number', request.model_number],
        ['Model Version', request.product_model_version],
        ['Serial Number', request.serial_number],
        ['Warranty Type', request.warranty_type],
        ['Purchase Date', formatDate(request.purchase_date)],
      ],
    },
    {
      title: 'Schedule and Request Notes',
      rows: [
        ['Preferred Date', formatDate(request.preferred_date)],
        ['Preferred Time', request.preferred_time],
        ['Issue Description', request.issue_description],
        ['Special Request', request.special_request],
        ['Reject Reason', request.verification_reject_reason],
        ['Verification Notes', request.verification_notes],
      ],
    },
  ]), [label, request]);

  return (
    <div className="er-ticket-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Request ${request.request_number} details`}>
      <div className="er-ticket-modal-card customer-request-detail-modal">
        <div className="er-ticket-modal-head">
          <div>
            <span>Customer Request Details</span>
            <h3>#{request.request_number}</h3>
            <p>{productLabel(request)} • {brandLabel(request)} • {request.city || 'City pending'}</p>
          </div>
          <button className="er-ticket-modal-close" onClick={onClose} type="button" aria-label="Close request details">
            <X size={18} />
          </button>
        </div>
        <div className="er-ticket-modal-body">
          <div className="customer-request-detail-toolbar">
            <span className={`cx-status-pill ${statusClass(label)}`}>{label}</span>
            <Link className="customer-modal-message-link" href={`/customer/messages?request=${request.id}`}>
              <MessageSquare size={16} /> Open Messages
            </Link>
          </div>
          {sections.map((section) => (
            <section className="er-ticket-detail-section" key={section.title}>
              <h4>{section.title}</h4>
              <div className="er-ticket-detail-grid">
                {section.rows.map(([rowLabel, value]) => (
                  <DetailRow key={rowLabel} label={rowLabel} value={value} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CustomerRequestCards({
  requests,
  loading,
  emptyText = 'No requests found.',
  compact = false,
}: {
  requests: ServiceRequest[];
  loading?: boolean;
  emptyText?: string;
  compact?: boolean;
}) {
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  if (loading) {
    return (
      <div className="customer-empty">
        <PackageSearch size={34} />
        <strong>Loading requests...</strong>
      </div>
    );
  }

  if (!requests.length) {
    return (
      <div className="customer-empty">
        <PackageSearch size={34} />
        <strong>{emptyText}</strong>
        <Link className="btn btn-primary" href="/customer/request">
          Start a Request
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className={compact ? 'cx-request-card-list compact' : 'cx-request-card-list'}>
        {requests.map((request) => {
          const label = statusLabel(request);
          return (
            <article className="cx-request-card" key={request.id}>
              <div className="cx-request-date">
                <CalendarDays size={14} />
                {formatDate(request.preferred_date || request.requested_at)}
              </div>
              <h3>#{request.request_number}</h3>
              <div className="cx-request-main">
                <span className="cx-service-icon"><Wrench size={22} /></span>
                <div>
                  <strong>{productLabel(request)}</strong>
                  <small><Tag size={13} /> {brandLabel(request)}</small>
                  <small><MapPin size={13} /> {request.city || 'N/A'}</small>
                  {request.customer_email ? <small><Mail size={13} /> {request.customer_email}</small> : null}
                </div>
              </div>
              {!compact ? <p>{request.issue_description || request.special_request || 'Request details are saved.'}</p> : null}
              <div className="cx-request-footer">
                <span className={`cx-status-pill ${statusClass(label)}`}>{label}</span>
                <button className="cx-view-details-button" onClick={() => setSelectedRequest(request)} type="button">
                  View Details <ChevronRight size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {selectedRequest ? (
        <CustomerRequestDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      ) : null}
    </>
  );
}
