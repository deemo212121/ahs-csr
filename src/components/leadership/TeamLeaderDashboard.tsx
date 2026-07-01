'use client';

import { ChevronLeft, ChevronRight, Gauge, Users } from 'lucide-react';
import { useState } from 'react';
import { CsrDashboard } from '@/components/csr/CsrDashboard';
import { TeamLeaderTeamDashboard } from '@/components/leadership/TeamLeaderTeamDashboard';

type Section = 'personal' | 'team';

export function TeamLeaderDashboard() {
  const [section, setSection] = useState<Section>('personal');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems: { key: Section; label: string; icon: typeof Gauge }[] = [
    { key: 'personal', label: 'Personal dashboard', icon: Gauge },
    { key: 'team', label: 'Your team dashboard', icon: Users },
  ];

  return (
    <div className="manager-dashboard php-manager-page team-leader-page verification-page-with-sidebar">
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
        {section === 'personal' ? <CsrDashboard /> : <TeamLeaderTeamDashboard />}
      </div>
    </div>
  );
}
