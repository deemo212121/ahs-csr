'use client';

import { useEffect, useState } from 'react';
import { fetchJsonWithFirebase, type AuthTokenUser } from '@/lib/auth/client';

export type StaffTeam = {
  leaderId: string;
  leaderName: string;
  memberIds: string[];
  memberNames: Record<string, string>;
};

// Team Leaders get back only their own team; CSR Managers/admins get every
// team (plus an "Unassigned" bucket for CSRs with no team leader set).
export function useStaffTeams(user: AuthTokenUser | null) {
  const [teams, setTeams] = useState<StaffTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const authUser = user;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchJsonWithFirebase<{ teams: StaffTeam[] }>(authUser, '/api/staff/teams');
        if (!cancelled) setTeams(data.teams);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load team structure.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { teams, loading, error };
}
