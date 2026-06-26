'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { TeamLeaderPlaceholderPage } from '@/components/leadership/TeamLeaderPlaceholderPage';

export default function TeamLeaderMistakeRoutePage() {
  return <RequireAuth roles={['team_leader']}><PortalShell title="Mistake"><TeamLeaderPlaceholderPage title="Mistake" description="Review, filter, and track mistakes for your team." icon="mistake" /></PortalShell></RequireAuth>;
}
