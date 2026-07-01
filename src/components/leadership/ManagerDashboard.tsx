'use client';

import { ChevronLeft, ChevronRight, Gauge, TrendingUp, Users } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CsrDashboard } from '@/components/csr/CsrDashboard';
import { ManagerTeamPerformanceDashboard } from '@/components/leadership/ManagerTeamPerformanceDashboard';
import { ManagerTeamManagementPage } from '@/components/leadership/ManagerTeamManagementPage';

type Section = 'personal' | 'team' | 'management';

function isSection(value: string | null): value is Section {
  return value === 'personal' || value === 'team' || value === 'management';
}

export function ManagerDashboard() {
  const searchParams = useSearchParams();
  const [section, setSection] = useState<Section>('personal');

  useEffect(() => {
    const requested = searchParams.get('section');
    if (isSection(requested)) setSection(requested);
  }, [searchParams]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems: { key: Section; label: string; icon: typeof Gauge }[] = [
    { key: 'personal', label: 'Personal dashboard', icon: Gauge },
    { key: 'team', label: 'Team performance dashboard', icon: TrendingUp },
    { key: 'management', label: 'Team Management', icon: Users },
  ];

  return (
    <div className="manager-dashboard php-manager-page verification-page-with-sidebar">
      <aside className={`verification-side-nav ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <button
          aria-label={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
          className="verification-side-nav-toggle"
          onClick={() => setSidebarCollapsed((current) => !current)}
          type="button"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`verification-side-nav-item ${section === item.key ? 'active' : ''}`}
                key={item.key}
                onClick={() => setSection(item.key)}
                title={item.label}
                type="button"
              >
                <Icon size={18} />
                {!sidebarCollapsed ? <span>{item.label}</span> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="verification-page-content">
        {section === 'personal' ? <CsrDashboard /> : null}
        {section === 'team' ? <ManagerTeamPerformanceDashboard /> : null}
        {section === 'management' ? <ManagerTeamManagementPage /> : null}
      </div>
    </div>
  );
}
