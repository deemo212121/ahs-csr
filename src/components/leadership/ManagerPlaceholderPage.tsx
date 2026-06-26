'use client';

import { AlertTriangle, ClipboardCheck, KeyRound, Megaphone } from 'lucide-react';

const iconMap = {
  branch: <ClipboardCheck size={38} />,
  mistake: <AlertTriangle size={38} />,
  warning: <AlertTriangle size={38} />,
  announcements: <Megaphone size={38} />,
  password: <KeyRound size={38} />,
};

type PlaceholderIcon = keyof typeof iconMap;

export function ManagerPlaceholderPage({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: PlaceholderIcon;
}) {
  return (
    <div className="manager-dashboard php-manager-page">
      <section className="manager-page-hero compact">
        <div>
          <h1>{iconMap[icon]} {title}</h1>
          <p>{description}</p>
        </div>
      </section>
      <section className="manager-list-panel tall-empty">
        <div className="manager-empty-state">This page shell is ready for the next migration pass.</div>
      </section>
    </div>
  );
}
