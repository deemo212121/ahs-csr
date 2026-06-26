'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { TeamLeaderPlaceholderPage } from '@/components/leadership/TeamLeaderPlaceholderPage';

export default function TeamLeaderWarningRoutePage() {
  return <RequireAuth roles={['team_leader']}><PortalShell title="Warning"><TeamLeaderPlaceholderPage title="Warning" description="Review, filter, and track warnings for your team." icon="warning" /></PortalShell></RequireAuth>;
}
