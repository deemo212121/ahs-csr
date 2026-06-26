'use client';

import { AlertTriangle, KeyRound, Megaphone, Users, Wrench } from 'lucide-react';

const iconMap = {
  agents: <Users size={38} />,
  technicians: <Wrench size={38} />,
  mistake: <AlertTriangle size={38} />,
  warning: <AlertTriangle size={38} />,
  announcements: <Megaphone size={38} />,
  password: <KeyRound size={38} />,
};

export function TeamLeaderPlaceholderPage({ title, description, icon = 'agents' }: { title: string; description: string; icon?: keyof typeof iconMap }) {
  return (
    <div className="manager-dashboard php-manager-page team-leader-page">
      <section className="manager-page-title-row compact">
        <div>
          <h1>{iconMap[icon]} {title}</h1>
          <p>{description}</p>
        </div>
      </section>
      <section className="manager-table-panel">
        <div className="manager-table-headline"><h2>{title}</h2><span>Queued for rebuild</span></div>
        <div className="manager-empty-cell">This page is ready with the PHP-style Team Leader layout. Backend actions will be wired in the next migration pass.</div>
      </section>
    </div>
  );
}
