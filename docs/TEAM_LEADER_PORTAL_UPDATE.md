# Team Leader Portal Update

This build ports the PHP Team Leader portal style into the TypeScript app.

Updated areas:
- Team Leader header/topbar
- Team Leader sidebar drawer menu
- Bottom navigation changed to Home / Request / Verify / Manual / Calls
- Dashboard layout with Profile, Team Agents, My Activity Today, Team Activity Today, Team Performance, Task Status, Recent Mistakes, and Recent Warnings
- Team Requests page with PHP-style filter panel and Team Tickets table
- Verification Queue remains wired to the same approval/reject flow
- Manual Ticket page added for Team Leader
- Team Call Queue page styled to match the PHP Team Leader call queue
- Added placeholder routes for Technicians, Team Agents, Mistake, Warning, Announcements, and Change Password so drawer links no longer 404

Notes:
- This is mainly the UI/layout migration pass for Team Leader.
- Full backend CRUD for Technicians, Mistake, Warning, Announcements, and Change Password still needs a future wiring pass.
- `npm run typecheck` passed in this package.
