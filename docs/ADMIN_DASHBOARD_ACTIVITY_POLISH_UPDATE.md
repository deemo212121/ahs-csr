# Admin Dashboard Activity Polish Update

Changes applied:

- Polished the Admin Dashboard cards and panel spacing so highlighted metric numbers no longer sit too close to nearby labels.
- Improved compact rows for announcements, warnings, and mistakes with clearer vertical spacing.
- Rebuilt the dashboard Recent Activity section as a cleaner timeline/card list.
- Recent Activity now reads `/api/admin/catalogs?type=activity-logs`, which already supports the ER `public.ticket_audit_log` table.
- Audit activity is sorted newest-to-oldest using `created_at` from the ER audit log.
- Ticket rows remain as a fallback, so the dashboard still shows activity even if the ER audit table is unavailable or not configured.
- Added a View all logs shortcut that opens `/admin/activity-logs` for full audit details.

ER audit log note:

Do not duplicate the ER audit log into the Admin Hub database unless you need an offline copy. The better approach is read-only access from the ER database because the audit records belong to the ER ticket system. The attached SQL rows match the existing `public.ticket_audit_log` shape already expected by the app:

- `id`
- `company_id`
- `ticket_id`
- `action`
- `field`
- `before_value`
- `after_value`
- `changed_by`
- `created_at`

The dashboard and Activity Logs page use `created_at` for recent-to-old filtering.
