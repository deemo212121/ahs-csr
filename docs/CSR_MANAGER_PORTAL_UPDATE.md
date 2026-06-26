# CSR Manager Portal Update

This update ports the CSR Manager PHP portal design into the TypeScript/Next.js app.

## Updated areas

- CSR Manager top header
  - Menu button
  - USHS logo/avatar
  - CSR Dashboard label
  - Latest date / CSR Manager subtitle
  - Back button
  - Notification dropdown
  - Messages shortcut
  - User dropdown with Announcements, Change Password, and Logout

- CSR Manager side drawer
  - Overview
  - Tickets
  - Verification Queue
  - Branch Assignment
  - Calls
  - Messages
  - Manual Ticket
  - Mistake
  - Warning
  - Report
  - Announcements
  - Change Password
  - Logout

- CSR Manager bottom navigation
  - Home
  - Request
  - Verify
  - Manual
  - Calls

- CSR Manager Dashboard
  - Overall Total cards
  - Today cards
  - Team Performance chart area
  - Task Status donut area
  - Team summary cards
  - Recent Mistakes and Recent Warnings panels

- CSR Manager Tickets
  - PHP-style header
  - Stats cards
  - Search / status filters
  - Service request table
  - View / edit action buttons

- CSR Manager Verification Queue
  - PHP-style queue header
  - Pending / approved / rejected counters
  - Search, status, and branch filters
  - Bulk approve / reject controls
  - Pending ticket review table

- CSR Manager Manual Ticket
  - New `/manager/manual` route
  - PHP-style manual ticket entry wrapper
  - Uses the existing service request form and Supabase create-ticket API

- CSR Manager Calls
  - PHP-style manager call queue shell
  - Stats cards and live call requests table layout

## Notes

The visual layout has been ported from the PHP screenshots. The remaining deeper backend work for the CSR Manager area is the live WebRTC call assignment flow, exact branch assignment logic, and full warning/mistake CRUD migration.
