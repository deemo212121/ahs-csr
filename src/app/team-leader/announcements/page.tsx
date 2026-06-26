'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { TeamLeaderPlaceholderPage } from '@/components/leadership/TeamLeaderPlaceholderPage';

export default function TeamLeaderAnnouncementsRoutePage() {
  return <RequireAuth roles={['team_leader']}><PortalShell title="Announcements"><TeamLeaderPlaceholderPage title="Announcements" description="Read announcements and messages shared with your team." icon="announcements" /></PortalShell></RequireAuth>;
}
