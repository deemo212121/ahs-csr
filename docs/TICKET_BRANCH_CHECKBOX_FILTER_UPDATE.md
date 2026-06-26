# Ticket Branch Checkbox Filter Update

Updated the CSR, Team Leader, and Manager ticket lists to use a Branch dropdown with checkboxes.

## Changed pages/components

- `src/components/csr/CsrTicketsPage.tsx`
- `src/components/leadership/TeamRequestsPage.tsx`
- `src/components/TicketsPage.tsx`
- `src/components/erTicketFilters.ts`
- `src/styles/globals.css`

## Added components

- `src/components/BranchCheckboxDropdown.tsx`
- `src/components/usePersistentBranchFilter.ts`

## Behavior

- Branches are populated from the live ER ticket location/branch values.
- Users can select multiple branches inside the dropdown.
- Empty selection means `All Branches`.
- CSR, Team Leader, and Manager each have separate saved branch selections.
- Selected branches are saved in `localStorage`, so reloading the website keeps the checked branches.
- Reset buttons clear the saved branch filter back to `All Branches`.
