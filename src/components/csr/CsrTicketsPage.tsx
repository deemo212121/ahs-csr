'use client';

import Link from 'next/link';
import { ClipboardList, Filter, PhoneCall, Plus, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';
import { BranchCheckboxDropdown } from '@/components/BranchCheckboxDropdown';
import { ErTicketListTable } from '@/components/ErTicketListTable';
import { erSourceText, erStatusText, filterErTickets, uniqueSorted } from '@/components/erTicketFilters';
import { useBranchFilter } from '@/lib/useBranchFilter';
import { BRANCHES } from '@/lib/branches';

export function CsrTicketsPage() {
  const { requests, loading, error, refresh } = useLeadershipRequests(500, 'view=tickets');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');

  const branchOptions = useMemo(() => [...BRANCHES], []);
  const { selectedBranches, setSelectedBranches } = useBranchFilter();
  const filtered = useMemo(
    () => filterErTickets(requests, { search, status, branches: selectedBranches, source }),
    [requests, search, status, selectedBranches, source],
  );
  const statuses = useMemo(() => uniqueSorted(requests.map(erStatusText)), [requests]);
  const sources = useMemo(() => uniqueSorted(requests.map(erSourceText)), [requests]);

  const reset = () => {
    setSearch('');
    setStatus('all');
    setSelectedBranches(branchOptions);
    setSource('all');
    void refresh();
  };

  return (
    <div className="manager-dashboard php-manager-page csr-ticket-page">
      <section className="manager-page-title-row split csr-request-title-row">
        <div>
          <h1><ClipboardList size={38} /> Tickets</h1>
          <p className="er-ticket-view-note">Use the branch checklist in Notification Settings (or here) to control which branches you see everywhere in the portal.</p>
        </div>
        <div className="button-row">
          <Link className="btn btn-primary" href="/csr/manual"><Plus size={16} /> Create Manual Ticket</Link>
          <Link className="btn btn-primary" href="/csr/calls"><PhoneCall size={16} /> Web Call Queue</Link>
          <button className="btn btn-primary" onClick={() => void refresh()} type="button"><RefreshCw size={16} /> Refresh</button>
        </div>
      </section>

      <section className="manager-table-panel csr-filter-panel">
        <div className="manager-table-headline"><h2><Filter size={18} /> Filter Tickets</h2></div>
        <div className="manager-request-controls tl-filter-grid csr-filter-grid">
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ticket, zip code, address, name, etc" /></label>
          <label><span>Repair Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All Repair Status</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <BranchCheckboxDropdown branches={branchOptions} selectedBranches={selectedBranches} onChange={setSelectedBranches} />
          <label><span>Ticket Source</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All Ticket Sources</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <div className="button-row"><button className="btn btn-primary" onClick={() => void refresh()} type="button"><Filter size={16} /> Apply Filters</button><button className="btn btn-secondary" onClick={reset} type="button"><RefreshCw size={16} /> Reset Branch View</button></div>
        </div>
      </section>

      {error ? <div className="customer-alert">{error}</div> : null}

      <section className="manager-table-panel csr-ticket-table-panel">
        <div className="manager-table-headline">
          <div>
            <h2><ClipboardList size={18} /> Branch Ticket List</h2>
            <p>Showing live ER tickets for the checked branches. Click a ticket number to view full details.</p>
          </div>
          <div className="button-row"><span>{filtered.length} shown</span><b className="er-columns-pill">View-only</b></div>
        </div>
        <ErTicketListTable
          requests={filtered}
          loading={loading}
          emptyMessage="No tickets found for the selected branch filters."
        />
      </section>
    </div>
  );
}
