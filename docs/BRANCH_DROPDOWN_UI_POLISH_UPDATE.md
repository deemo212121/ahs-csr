# Branch Dropdown UI Polish Update

Updated the CSR, Team Leader, and Manager ticket list Branch filter dropdown.

## What changed

- Replaced the inline dropdown with a floating popover so it no longer gets cut off inside the filter card.
- Added branch search inside the dropdown.
- Added quick actions for All Branches and Select Shown.
- Shows selected branch count and a preview of selected branches.
- Individual branch checkboxes stay usable when All Branches is active.
- Existing localStorage persistence remains active, so checked branches stay saved after reload.

## Main files updated

- `src/components/BranchCheckboxDropdown.tsx`
- `src/styles/globals.css`
