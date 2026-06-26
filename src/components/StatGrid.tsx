import { Clock3, PhoneCall, ShieldCheck, TicketCheck } from 'lucide-react';

export function StatGrid({
  pending,
  approved,
  rejected,
  calls,
}: {
  pending: number;
  approved: number;
  rejected: number;
  calls: number;
}) {
  const stats = [
    { label: 'Pending Verification', value: pending, icon: <Clock3 size={18} /> },
    { label: 'Approved Tickets', value: approved, icon: <TicketCheck size={18} /> },
    { label: 'Rejected', value: rejected, icon: <ShieldCheck size={18} /> },
    { label: 'Active Calls', value: calls, icon: <PhoneCall size={18} /> },
  ];

  return (
    <div className="stats-grid">
      {stats.map((stat) => (
        <div className="stat" key={stat.label}>
          <div className="stat-label">
            {stat.icon} {stat.label}
          </div>
          <div className="stat-value">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
