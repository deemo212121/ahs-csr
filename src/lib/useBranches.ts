'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';
import { BRANCHES as STATIC_BRANCHES } from '@/lib/branches';

const STATIC_FALLBACK: string[] = [...STATIC_BRANCHES];

type BranchRow = { id: string; name: string; sort_order: number };

// Replaces the old hardcoded BRANCHES import everywhere a branch checklist
// is built — reads from the editable `branches` table (see Admin > Branches)
// instead, so adding a branch there shows up immediately without a code
// deploy. Falls back to the static list if the fetch fails for any reason
// (not logged in yet, table not migrated), so nothing breaks in the meantime.
export function useBranches() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<string[]>(STATIC_FALLBACK);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchJsonWithFirebase<{ branches?: BranchRow[] }>(user, '/api/branches');
      const names = (data.branches ?? []).map((b) => b.name).filter(Boolean);
      if (names.length) setBranches(names);
    } catch {
      // Keep the static fallback list.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { branches, loading, refresh };
}
