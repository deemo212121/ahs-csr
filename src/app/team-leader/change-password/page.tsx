'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { TeamLeaderPlaceholderPage } from '@/components/leadership/TeamLeaderPlaceholderPage';

export default function TeamLeaderChangePasswordRoutePage() {
  return <RequireAuth roles={['team_leader']}><PortalShell title="Change Password"><TeamLeaderPlaceholderPage title="Change Password" description="Update the Team Leader account password." icon="password" /></PortalShell></RequireAuth>;
}
