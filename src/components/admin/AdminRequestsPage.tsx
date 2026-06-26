'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, List, RefreshCw, Search } from 'lucide-react';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';
import { ErTicketListTable } from '@/components/ErTicketListTable';
import { erStatusText, filterErTickets } from '@/components/erTicketFilters';

function todayLabel() {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
}

export function AdminRequestsPage() {
  const { requests, loading, error, refresh } = useLeadershipRequests(500, 'view=tickets');
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => filterErTickets(requests, { search }), [search, requests]);

  const total = requests.length;
  const acknowledged = requests.filter((request) => erStatusText(request) === 'Acknowledged').length;
  const ready = requests.filter((request) => erStatusText(request).toLowerCase().includes('ready')).length;
  const closed = requests.filter((request) => erStatusText(request).toLowerCase().includes('closed')).length;

  return (
    <div className="admin-php-page requests">
      <section className="admin-php-hero">
        <div className="admin-php-hero-title">
          <span><ClipboardList size={34} /></span>
          <div>
            <h1>Service Requests</h1>
            <p>View-only live tickets from the ER tickets table. Click a ticket number to view details.</p>
          </div>
        </div>
        <div className="admin-php-hero-actions">
          <span className="admin-date-pill"><CalendarDays size={13} /> {todayLabel()}</span>
          <button className="admin-outline-button" onClick={() => void refresh()} type="button"><RefreshCw size={15} /></button>
        </div>
      </section>

      <div className="admin-php-count-grid four">
        <div className="admin-php-counter"><div><span>Total</span><strong>{total}</strong></div><b><ClipboardList size={18} /></b></div>
        <div className="admin-php-counter"><div><span>Acknowledged</span><strong>{acknowledged}</strong></div><b><CalendarDays size={18} /></b></div>
        <div className="admin-php-counter"><div><span>Ready</span><strong>{ready}</strong></div><b><RefreshCw size={18} /></b></div>
        <div className="admin-php-counter"><div><span>Closed</span><strong>{closed}</strong></div><b><List size={18} /></b></div>
      </div>

      <section className="admin-php-table-panel">
        <div className="admin-php-panel-head">
          <h2><List size={16} /> Ticket List</h2>
          <span>{filtered.length} records found</span>
        </div>
        <div className="admin-request-toolbar">
          <label>
            Show
            <select defaultValue="25">
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            entries
          </label>
          <div className="admin-request-search">
            <Search size={18} />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Search ticket, model, location, status..." value={search} />
          </div>
        </div>
        {error ? <div className="login-alert">{error}</div> : null}
        <ErTicketListTable requests={filtered} loading={loading} emptyMessage="No ER tickets found." />
      </section>
    </div>
  );
}
