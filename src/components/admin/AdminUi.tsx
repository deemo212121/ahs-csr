'use client';

import type { ReactNode } from 'react';

export type AdminStat = {
  label: string;
  value: number | string;
  tone?: 'cyan' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'neutral';
  helper?: string;
  icon?: ReactNode;
};

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-page-head">
      <div>
        {eyebrow ? <div className="admin-page-kicker">{eyebrow}</div> : null}
        <h1 className="admin-page-title">{title}</h1>
        <p className="admin-page-subtitle">{description}</p>
      </div>
      {actions ? <div className="button-row">{actions}</div> : null}
    </div>
  );
}

export function AdminStatGrid({ stats }: { stats: AdminStat[] }) {
  return (
    <div className="admin-stats-grid">
      {stats.map((stat) => (
        <div className={`admin-stat-card ${stat.tone ?? 'neutral'}`} key={stat.label}>
          {stat.icon ? <div className="admin-stat-icon">{stat.icon}</div> : null}
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          {stat.helper ? <small>{stat.helper}</small> : null}
        </div>
      ))}
    </div>
  );
}

export function AdminPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div className="admin-panel-head-copy">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AdminEmptyState({ label }: { label: string }) {
  return <div className="admin-empty-state">{label}</div>;
}

export type AdminColumn<T> = {
  label: string;
  render: (row: T) => ReactNode;
};

export function AdminDataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyLabel,
}: {
  columns: AdminColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  emptyLabel: string;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={getRowKey(row, index)}>
                {columns.map((column) => (
                  <td key={column.label}>{column.render(row)}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="admin-empty-cell" colSpan={columns.length}>
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

