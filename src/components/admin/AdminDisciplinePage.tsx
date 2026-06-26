'use client';

import { useMemo } from 'react';
import { AdminDataTable, AdminPageHeader, AdminPanel, AdminStatGrid, type AdminColumn } from '@/components/admin/AdminUi';
import { getDisciplineRows } from '@/components/admin/adminData';
import { useLeadershipRequests } from '@/components/leadership/useLeadershipRequests';

type DisciplineKind = 'warning' | 'mistake';

export function AdminDisciplinePage({ kind }: { kind: DisciplineKind }) {
  const { requests, error } = useLeadershipRequests();
  const rows = useMemo(() => getDisciplineRows(kind, requests), [kind, requests]);
  const title = kind === 'warning' ? 'Warning' : 'Mistake';
  const positiveCount = rows.filter((row) => row.count > 0).length;

  return (
    <div className="admin-dashboard">
      <AdminPageHeader
        description={`Admin can send ${title.toLowerCase()} records to CSR Managers, Team Leaders, and Agents.`}
        eyebrow="Discipline records"
        title={title}
      />
      <AdminStatGrid
        stats={[
          { label: `${title}s Issued`, value: rows.reduce((sum, row) => sum + row.count, 0), tone: 'cyan' },
          { label: 'Recipients', value: rows.length, tone: 'blue' },
          { label: 'Active Records', value: positiveCount, tone: kind === 'warning' ? 'yellow' : 'red' },
        ]}
      />
      {error ? <div className="customer-alert">{error}</div> : null}
      <div className="admin-grid-2 admin-discipline-grid">
        <AdminPanel subtitle={`Send a new ${title.toLowerCase()} record`} title={`Create ${title}`}>
          <div className="form-grid admin-form-grid">
            <div className="field">
              <label>Role</label>
              <select defaultValue="csr">
                <option value="csr_manager">CSR Manager</option>
                <option value="team_leader">Team Leader</option>
                <option value="csr">CSR Agent</option>
              </select>
            </div>
            <div className="field">
              <label>Recipient</label>
              <select defaultValue={rows[0]?.name || ''}>
                {rows.map((row) => (
                  <option key={`${row.name}-${row.team}`} value={row.name}>
                    {row.name} | {row.team}
                  </option>
                ))}
              </select>
            </div>
            <div className="field wide">
              <label>Title</label>
              <input placeholder={`${title} title`} type="text" />
            </div>
            <div className="field wide">
              <label>Message</label>
              <textarea placeholder={`Describe the ${title.toLowerCase()}...`} />
            </div>
          </div>
          <div className="button-row">
            <button className="btn btn-primary" type="button">
              Send {title}
            </button>
          </div>
        </AdminPanel>

        <AdminPanel subtitle={`Existing ${title.toLowerCase()} records`} title={`Sent ${title}s`}>
          <AdminDataTable
            columns={[
              {
                label: 'Recipient',
                render: (row: (typeof rows)[number]) => (
                  <>
                    <strong>{row.name}</strong>
                    <br />
                    <span className="muted">
                      {row.team} | {row.role}
                    </span>
                  </>
                ),
              },
              { label: 'Title', render: (row: (typeof rows)[number]) => row.title },
              { label: 'Count', render: (row: (typeof rows)[number]) => row.count },
              { label: 'Sent At', render: (row: (typeof rows)[number]) => row.sentAt },
            ] satisfies AdminColumn<(typeof rows)[number]>[]}
            emptyLabel={`No ${title.toLowerCase()} records yet.`}
            getRowKey={(row) => `${row.name}-${row.title}-${row.sentAt}`}
            rows={rows}
          />
        </AdminPanel>
      </div>
    </div>
  );
}

