'use client';

import { useMemo } from 'react';
import { AdminPageHeader, AdminPanel, AdminStatGrid } from '@/components/admin/AdminUi';
import { getAnnouncementRows } from '@/components/admin/adminData';

export function AdminAnnouncementsPage() {
  const announcements = useMemo(() => getAnnouncementRows(), []);

  return (
    <div className="admin-dashboard">
      <AdminPageHeader
        description="Broadcast updates to managers, team leaders, agents, or internal groups."
        eyebrow="Internal communication"
        title="Announcements"
      />
      <AdminStatGrid
        stats={[
          { label: 'Posted', value: announcements.length, tone: 'cyan' },
          {
            label: 'Active',
            value: announcements.filter((item) => item.status === 'Active').length,
            tone: 'green',
          },
          {
            label: 'Drafts',
            value: announcements.filter((item) => item.status === 'Draft').length,
            tone: 'yellow',
          },
        ]}
      />
      <div className="admin-grid-2">
        <AdminPanel subtitle="Compose and publish internal notices" title="Create Announcement">
          <div className="form-grid admin-form-grid">
            <div className="field wide">
              <label>Title</label>
              <input placeholder="Weekend call queue advisory" type="text" />
            </div>
            <div className="field">
              <label>Target Group</label>
              <select defaultValue="all">
                <option value="all">All internal staff</option>
                <option value="managers">CSR Managers</option>
                <option value="leaders">Team Leaders</option>
                <option value="agents">Agents</option>
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select defaultValue="active">
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="field wide">
              <label>Message</label>
              <textarea placeholder="Write the announcement message..." />
            </div>
          </div>
          <div className="button-row">
            <button className="btn btn-primary" type="button">
              Save Announcement
            </button>
            <button className="btn btn-secondary" type="button">
              Save Draft
            </button>
          </div>
        </AdminPanel>

        <AdminPanel subtitle="Most recent posted notices" title="Posted by Admin">
          <div className="admin-announcement-list">
            {announcements.map((item) => (
              <div className="admin-announcement-card" key={`${item.title}-${item.date}`}>
                <div className="admin-announcement-head">
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.target}</span>
                  </div>
                  <small>{item.status}</small>
                </div>
                <p>{item.message}</p>
                <small>{item.date}</small>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}

