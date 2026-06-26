'use client';

export const dynamic = 'force-dynamic';

import { PortalShell } from '@/components/PortalShell';
import { RequireAuth } from '@/components/RequireAuth';
import { TeamLeaderPlaceholderPage } from '@/components/leadership/TeamLeaderPlaceholderPage';

export default function TeamLeaderTechniciansRoutePage() {
  return <RequireAuth roles={['team_leader']}><PortalShell title="Technicians"><TeamLeaderPlaceholderPage title="Technicians" description="Team Leader technician lookup and request support page." icon="technicians" /></PortalShell></RequireAuth>;
}
