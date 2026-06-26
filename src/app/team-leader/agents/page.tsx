'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { TeamLeaderPlaceholderPage } from '@/components/leadership/TeamLeaderPlaceholderPage';

export default function TeamLeaderAgentsRoutePage() {
  return <RequireAuth roles={['team_leader']}><PortalShell title="Team Agents"><TeamLeaderPlaceholderPage title="Team Agents" description="View the regular CSR agents assigned under this Team Leader." icon="agents" /></PortalShell></RequireAuth>;
}
