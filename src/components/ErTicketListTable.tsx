'use client';

import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StickyHorizontalScroll } from '@/components/StickyHorizontalScroll';
import type { ServiceRequest } from '@/lib/types';

type DetailValue = string | number | boolean | null | undefined;
type DetailSection = { title: string; rows: [string, DetailValue][] };

function empty(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function yn(value?: boolean | null) {
  if (value === true) return 'Y';
  if (value === false) return 'N';
  return '—';
}

function dateOnly(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function dateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function ticketAge(request: ServiceRequest) {
  const er = request.er_ticket;
  const sourceDate = er?.call_received_date || er?.created_at || request.requested_at;
  if (!sourceDate) return '—';
  const parsed = new Date(sourceDate);
  if (Number.isNaN(parsed.getTime())) return '—';
  const days = Math.max(0, Math.ceil((Date.now() - parsed.getTime()) / 86400000));
  return `${days}d`;
}

function statusSpend(request: ServiceRequest) {
  const delay = request.er_ticket?.delay;
  if (typeof delay === 'number') return `${delay}d`;

  const changedAt = request.er_ticket?.status_changed_at;
  if (!changedAt) return '0d';
  const parsed = new Date(changedAt);
  if (Number.isNaN(parsed.getTime())) return '0d';
  const days = Math.max(0, Math.ceil((Date.now() - parsed.getTime()) / 86400000));
  return `${days}d`;
}

function statusText(request: ServiceRequest) {
  return request.er_ticket?.status || request.job_status?.status_name || '—';
}

function productText(request: ServiceRequest) {
  return request.er_ticket?.product_type || request.manual_appliance_type || request.model_number || '—';
}

function cityText(request: ServiceRequest) {
  return request.er_ticket?.customer_city || request.city || '—';
}

function customerText(request: ServiceRequest) {
  return request.er_ticket?.customer_name || request.full_name || (request.customer_id ? `ID ${request.customer_id.slice(0, 8)}` : '—');
}

function phoneText(request: ServiceRequest) {
  return request.er_ticket?.customer_phone || request.phone_number || '—';
}

function addressText(request: ServiceRequest) {
  const er = request.er_ticket;
  const address = [er?.customer_address, er?.customer_address2].filter(Boolean).join(' ');
  return address || [request.service_address, request.service_address_2].filter(Boolean).join(' ') || '—';
}

function DetailRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  return (
    <div className="er-ticket-detail-row">
      <span>{label}</span>
      <strong>{empty(value)}</strong>
    </div>
  );
}

function TicketDetailsModal({ request, onClose }: { request: ServiceRequest; onClose: () => void }) {
  const er = request.er_ticket;
  const ticketNo = er?.ticket_no || request.request_number;

  const sections = useMemo<DetailSection[]>(() => ([
    {
      title: 'Ticket Information',
      rows: [
        ['Ticket No', ticketNo],
        ['Warranty', er?.warranty || request.warranty_type],
        ['Ticket Source', er?.ticket_source || request.ticket_source],
        ['Status', er?.status || request.job_status?.status_name],
        ['Repair / Diagnosed', yn(er?.diagnosed)],
        ['Customer Prefer', yn(er?.customer_pref)],
        ['Redo', yn(er?.redo)],
        ['Fake Ticket', yn(er?.fake_ticket)],
        ['Part Order', er?.part_order],
        ['Flow Type', er?.flow_type],
        ['Stage', er?.stage],
        ['Type', er?.type],
      ],
    },
    {
      title: 'Customer Information',
      rows: [
        ['Customer Name', customerText(request)],
        ['Phone', phoneText(request)],
        ['Second Phone', er?.customer_second_phone || request.secondary_phone],
        ['Email', er?.customer_email || request.customer_email],
        ['Address', addressText(request)],
        ['City', cityText(request)],
        ['State', er?.customer_state || request.state],
        ['ZIP', er?.customer_zip || request.zip_code],
        ['Address Note', er?.customer_address_note || request.landmark],
        ['Customer ID', er?.customer_id || request.customer_id],
      ],
    },
    {
      title: 'Product / Appliance',
      rows: [
        ['Product', productText(request)],
        ['Manufacturer', er?.manufacturer || request.manual_brand],
        ['Model', er?.model || request.model_number],
        ['Model Version', er?.model_version || request.product_model_version],
        ['Serial', er?.serial || request.serial_number],
        ['Purchase Date', dateOnly(er?.purchase_date || request.purchase_date)],
        ['Account', er?.account],
        ['Claim Company', er?.claim_company],
      ],
    },
    {
      title: 'Schedule / Operations',
      rows: [
        ['Location', er?.location || request.region],
        ['Technician', er?.technician],
        ['Schedule Date', dateOnly(er?.schedule_date || request.preferred_date)],
        ['Time Slot', er?.time_slot || request.preferred_time],
        ['Call Received Date', dateOnly(er?.call_received_date)],
        ['Aging', typeof er?.aging === 'number' ? `${er.aging}d` : ticketAge(request)],
        ['Status Spend', statusSpend(request)],
        ['Calls', er?.calls ?? 0],
        ['Delay', typeof er?.delay === 'number' ? `${er.delay}d` : null],
      ],
    },
    {
      title: 'Notes / Details',
      rows: [
        ['Internal Note', er?.internal_note || request.special_request],
        ['Problem Description', er?.problem_description || request.issue_description],
        ['Original Ticket No', er?.original_ticket_no],
        ['Created At', dateTime(er?.created_at || request.requested_at)],
        ['Updated At', dateTime(er?.updated_at || request.updated_at)],
        ['Status Changed At', dateTime(er?.status_changed_at)],
        ['Status Changed By', er?.status_changed_by],
      ],
    },
  ]), [er, request, ticketNo]);

  return (
    <div className="er-ticket-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Ticket ${ticketNo} details`}>
      <div className="er-ticket-modal-card">
        <div className="er-ticket-modal-head">
          <div>
            <span>Ticket Details</span>
            <h3>{empty(ticketNo)}</h3>
            <p>This is view-only data from the live ER tickets table.</p>
          </div>
          <button className="er-ticket-modal-close" onClick={onClose} type="button" aria-label="Close ticket details">
            <X size={18} />
          </button>
        </div>
        <div className="er-ticket-modal-body">
          {sections.map((section) => (
            <section className="er-ticket-detail-section" key={section.title}>
              <h4>{section.title}</h4>
              <div className="er-ticket-detail-grid">
                {section.rows.map(([label, value]) => (
                  <DetailRow key={label} label={label} value={value} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ErTicketListTable({
  requests,
  loading,
  emptyMessage = 'No tickets found.',
}: {
  requests: ServiceRequest[];
  loading: boolean;
  emptyMessage?: string;
}) {
  const [selected, setSelected] = useState<ServiceRequest | null>(null);

  return (
    <>
      <StickyHorizontalScroll className="er-ticket-table-scroll">
        <table className="manager-data-table er-ticket-list-table">
          <thead>
            <tr>
              <th>Ticket No</th>
              <th>Wty</th>
              <th>Ticket Source</th>
              <th>Cx Name</th>
              <th>City</th>
              <th>Loc</th>
              <th>Product</th>
              <th>Model</th>
              <th>Internal Note</th>
              <th>Repair</th>
              <th>Technician</th>
              <th>Cx Prefer</th>
              <th>Schedule</th>
              <th>Status</th>
              <th>Phone</th>
              <th>Redo</th>
              <th>Aging</th>
              <th>Status Spend</th>
              <th>Calls</th>
              <th>Part Order</th>
              <th>Posting</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={21} className="manager-empty-cell">Loading live ER tickets...</td></tr>
            ) : requests.length ? requests.map((request) => {
              const er = request.er_ticket;
              const status = statusText(request);
              const ticketNo = er?.ticket_no || request.request_number;
              return (
                <tr key={request.id}>
                  <td>
                    <button className="er-ticket-no-button" type="button" onClick={() => setSelected(request)}>
                      {empty(ticketNo)}
                    </button>
                  </td>
                  <td>{empty(er?.warranty || request.warranty_type)}</td>
                  <td>{empty(er?.ticket_source || request.ticket_source)}</td>
                  <td>{customerText(request)}</td>
                  <td>{cityText(request)}</td>
                  <td>{empty(er?.location || request.region)}</td>
                  <td>{productText(request)}</td>
                  <td>{empty(er?.model || request.model_number)}</td>
                  <td>{empty(er?.internal_note || request.special_request)}</td>
                  <td>{yn(er?.diagnosed)}</td>
                  <td>{empty(er?.technician)}</td>
                  <td>{yn(er?.customer_pref)}</td>
                  <td>{dateOnly(er?.schedule_date || request.preferred_date)}</td>
                  <td><span className="er-status-link">{empty(status)}</span></td>
                  <td>{phoneText(request)}</td>
                  <td>{yn(er?.redo)}</td>
                  <td><span className="er-age-good">{typeof er?.aging === 'number' ? `${er.aging}d` : ticketAge(request)}</span></td>
                  <td><span className="er-age-good">{statusSpend(request)}</span></td>
                  <td>{empty(er?.calls ?? 0)}</td>
                  <td>{empty(er?.part_order)}</td>
                  <td>{dateOnly(er?.created_at || request.requested_at)}</td>
                </tr>
              );
            }) : (
              <tr><td colSpan={21} className="manager-empty-cell">{emptyMessage}</td></tr>
            )}
          </tbody>
        </table>
      </StickyHorizontalScroll>
      {selected ? <TicketDetailsModal request={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
