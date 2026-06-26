# Customer Portal UI Update

This update ports the customer portal screens closer to the existing PHP customer portal style while keeping the TypeScript/Supabase/Firebase architecture.

## Updated screens

- Customer top header
  - back button
  - US In Home Services logo/brand
  - page title
  - notification icon
  - messages icon
  - customer dropdown with Profile, My Requests, Logout

- Fixed bottom navigation
  - Home
  - Request
  - My Requests
  - Messages
  - Profile

- Customer Dashboard
  - welcome card
  - request service / request call buttons
  - stats cards
  - quick actions
  - services grid
  - recent requests list

- Request Service
  - centered dark PHP-style request form
  - sectioned layout for customer, product, service details, and photo upload
  - keeps ZIP autofill through `/api/service-areas`

- My Requests
  - PHP-style status summary
  - search and filter chips
  - large request cards with status and View Details link

- Messages
  - left request list
  - right conversation area
  - empty-state prompt until a request is selected

- My Profile
  - centered profile hero
  - edit profile form styling

## Responsive notes

The customer portal is now optimized for phone and tablet use:

- bottom navigation stays fixed for thumb access
- topbar compresses on smaller screens
- request/message grids collapse to one column
- message request list becomes horizontally scrollable on tablet
- form fields collapse cleanly on mobile
