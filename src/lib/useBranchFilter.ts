'use client';

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { BRANCHES } from '@/lib/branches';

const EMPTY_SELECTION: string[] = [];
const ALL_BRANCHES: string[] = [...BRANCHES];

function normalize(next: string[]) {
  return (next.length === 0 || next.length === BRANCHES.length) ? EMPTY_SELECTION : next;
}

// Single shared branch/region filter for the logged-in user, saved to their
// profile (via /api/me/preferences) so it's the same on every device/page —
// Tickets, Verify, Messages, Calls, Call History, and Notification Settings
// all read/write this one value. An empty saved list means "all branches"
// (mirrors notification settings' filterRegions convention), so unchecking
// every branch in the UI resets back to "all" rather than "show nothing".
//
// Important: selectedBranches must have a STABLE array reference when the
// underlying value hasn't changed, otherwise consumers that useEffect on it
// (e.g. syncing local pending state) will loop forever. Don't fall back with
// `?? []` / `[...x]` inline — those allocate a new array every render.
export function useBranchFilter() {
  const { profile, updateFilterRegions } = useAuth();

  const saved = profile?.preferences?.filterRegions ?? EMPTY_SELECTION;
  const selectedBranches = saved.length ? saved : ALL_BRANCHES;

  // Applies + persists immediately, rejecting on save failure so callers that
  // want to show explicit save feedback (e.g. a Save button) can catch it.
  const applyBranches = useCallback((next: string[]) => updateFilterRegions(normalize(next)), [updateFilterRegions]);

  // Fire-and-forget variant for pages that just want instant apply with no
  // save UI of their own.
  const setSelectedBranches = useCallback((next: string[]) => {
    applyBranches(next).catch((err) => console.error('Failed to save branch filter:', err));
  }, [applyBranches]);

  return { selectedBranches, setSelectedBranches, applyBranches };
}
