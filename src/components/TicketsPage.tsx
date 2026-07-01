'use client';

import { ListFilter, Plus, RefreshCw, Search, Ticket } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useLiveUpdate } from '@/lib/notifications/useLiveUpdate';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';
import { BranchCheckboxDropdown } from '@/components/BranchCheckboxDropdown';
import { ErTicketListTable } from '@/components/ErTicketListTable';
import { erLocationText, erStatusText, filterErTickets, uniqueSorted } from '@/components/erTicketFilters';
import { usePersistentBranchFilter } from '@/components/usePersistentBranchFilter';

export function TicketsPage() {
  const { requests, loading, error, refresh } = useLeadershipRequests(500, 'view=tickets');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  useLiveUpdate('verify', () => { void refresh(); });

  const branchOptions = useMemo(() => uniqueSorted(requests.map(erLocationText)), [requests]);
  const { selectedBranches, setSelectedBranches } = usePersistentBranchFilter('ahs-manager-ticket-branches', branchOptions);
  const filtered = useMemo(() => filterErTickets(requests, { search, status, branches: selectedBranches }), [requests, search, status, selectedBranches]);
  const statuses = useMemo(() => uniqueSorted(requests.map(erStatusText)), [requests]);

  const totals = useMemo(() => {
    const total = requests.length;
    const acknowledged = requests.filter((request) => erStatusText(request) === 'Acknowledged').length;
    const closed = requests.filter((request) => erStatusText(request).toLowerCase().includes('closed')).length;
    const ready = requests.filter((request) => erStatusText(request).toLowerCase().includes('ready')).length;
    return { total, acknowledged, closed, ready };
  }, [requests]);

  return (
    <div className="manager-dashboard php-manager-page">
      <section className="manager-page-hero">
        <div>
          <h1><Ticket size={34} /> Tickets</h1>
          <p>View-only live tickets from the ER tickets table.</p>
        </div>
        <Link className="btn btn-primary" href="/manager/manual">
          <Plus size={17} /> New Manual Ticket
        </Link>
      </section>

      <section className="manager-ticket-stats">
        <div><span>Total</span><strong>{totals.total}</strong><i><Ticket size={17} /></i></div>
        <div><span>Acknowledged</span><strong>{totals.acknowledged}</strong><i><ListFilter size={17} /></i></div>
        <div><span>Ready</span><strong>{totals.ready}</strong><i><ListFilter size={17} /></i></div>
        <div><span>Closed</span><strong>{totals.closed}</strong><i><ListFilter size={17} /></i></div>
      </section>

      {error ? <div className="customer-alert">{error}</div> : null}

      <section className="manager-table-panel">
        <div className="manager-table-headline">
          <div>
            <h2><ListFilter size={18} /> Ticket List</h2>
            <p>Complete ticket details with warranty, source, product, model, status, calls, and posting date. Click a ticket number to view all details.</p>
          </div>
          <div className="button-row"><span>{filtered.length} records found</span><b className="er-columns-pill">View-only</b></div>
        </div>
        <div className="manager-request-controls manager-ticket-filter-controls">
          <label className="ticket-filter-field">
            <span>Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ticket, zip code, address, name, etc" />
          </label>
          <label className="ticket-filter-field">
            <span>Repair Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All Repair Status</option>
              {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <BranchCheckboxDropdown branches={branchOptions} selectedBranches={selectedBranches} onChange={setSelectedBranches} />
          <div className="button-row ticket-filter-actions">
            <button className="btn btn-primary" onClick={() => void refresh()} type="button"><Search size={16} /> Filter</button>
            <button className="btn btn-secondary" onClick={() => { setSearch(''); setStatus('all'); setSelectedBranches(branchOptions); void refresh(); }} type="button"><RefreshCw size={16} /> Reset</button>
          </div>
        </div>
        <ErTicketListTable requests={filtered} loading={loading} />
      </section>
    </div>
  );
}
