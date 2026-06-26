import type { ServiceRequest } from '@/lib/types';

export function StatusBadge({ status }: { status: ServiceRequest['verification_status'] }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}
