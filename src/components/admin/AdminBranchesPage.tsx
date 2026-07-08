'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, GripVertical, MapPinned, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';

type BranchRow = { id: string; name: string; sort_order: number; created_at: string; updated_at: string };

function AdminPageHero({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="admin-php-hero">
      <div className="admin-php-hero-title">
        <span>{icon}</span>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="admin-php-hero-actions">{children}</div>
    </section>
  );
}

function AdminCounterCard({ label, value, icon }: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <div className="admin-php-counter">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {icon ? <b>{icon}</b> : null}
    </div>
  );
}

export function AdminBranchesPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJsonWithFirebase<{ branches?: BranchRow[] }>(user, '/api/branches');
      setBranches(data.branches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load branches.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addBranch(event: FormEvent) {
    event.preventDefault();
    if (!user || !name.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      await fetchJsonWithFirebase(user, '/api/branches', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      setName('');
      setNotice(`"${name.trim()}" added.`);
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to add branch.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteBranch(branch: BranchRow) {
    if (!user) return;
    if (!window.confirm(`Remove "${branch.name}"? This immediately removes it from every branch filter/checklist in the app.`)) return;
    setNotice(null);
    try {
      await fetchJsonWithFirebase(user, `/api/branches?id=${encodeURIComponent(branch.id)}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to remove branch.');
    }
  }

  // Native HTML5 drag-and-drop — no extra dependency needed. Reordering the
  // local list happens instantly on drag-over for a responsive feel; the new
  // order is only persisted to the server once the drag actually ends.
  function handleDragStart(id: string) {
    setDragId(id);
  }

  function handleDragOver(event: React.DragEvent, overId: string) {
    event.preventDefault();
    if (!dragId || dragId === overId) return;
    setBranches((current) => {
      const fromIndex = current.findIndex((b) => b.id === dragId);
      const toIndex = current.findIndex((b) => b.id === overId);
      if (fromIndex === -1 || toIndex === -1) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  async function handleDragEnd() {
    setDragId(null);
    if (!user) return;
    setReordering(true);
    try {
      await fetchJsonWithFirebase(user, '/api/branches', {
        method: 'PATCH',
        body: JSON.stringify({ order: branches.map((b) => b.id) }),
      });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to save the new order.');
      await load();
    } finally {
      setReordering(false);
    }
  }

  const sortedAlphabetically = useMemo(() => [...branches].sort((a, b) => a.name.localeCompare(b.name)), [branches]);

  return (
    <div className="admin-php-page">
      <AdminPageHero
        icon={<MapPinned size={34} />}
        title="Manage Branches"
        subtitle="Add, remove, and reorder the branch list used by every branch filter/checklist in the app."
      >
        <span className="admin-date-pill"><CalendarDays size={13} /> Live</span>
      </AdminPageHero>

      <div className="admin-php-count-grid">
        <AdminCounterCard icon={<MapPinned size={18} />} label="Total Branches" value={branches.length} />
      </div>

      <section className="admin-php-form-panel">
        <div className="admin-php-panel-head"><h2>Add New Branch</h2></div>
        <form className="admin-php-inline-form" onSubmit={addBranch}>
          <label>
            Branch Name
            <input onChange={(event) => setName(event.target.value)} placeholder="e.g. Salt Lake City" required value={name} />
          </label>
          <button disabled={saving} type="submit"><Plus size={17} /> {saving ? 'Adding...' : 'Add Branch'}</button>
        </form>
        {notice ? <p className="admin-php-notice">{notice}</p> : null}
      </section>

      <section className="admin-php-table-panel">
        <div className="admin-php-panel-head">
          <h2>Branch Order</h2>
          <span>{reordering ? 'Saving order…' : 'Drag to reorder'}</span>
        </div>

        {loading ? <div className="admin-empty-state">Loading branches...</div> : null}
        {error ? <div className="login-alert">{error}</div> : null}

        {!loading && !error ? (
          <ul className="admin-branch-drag-list">
            {branches.map((branch) => (
              <li
                className={`admin-branch-drag-row ${dragId === branch.id ? 'dragging' : ''}`}
                draggable
                key={branch.id}
                onDragEnd={() => void handleDragEnd()}
                onDragOver={(event) => handleDragOver(event, branch.id)}
                onDragStart={() => handleDragStart(branch.id)}
              >
                <span className="admin-branch-drag-handle" aria-hidden="true"><GripVertical size={16} /></span>
                <span className="admin-branch-drag-name">{branch.name}</span>
                <button
                  aria-label={`Remove ${branch.name}`}
                  className="admin-branch-drag-delete"
                  onClick={() => void deleteBranch(branch)}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
            {!branches.length ? <li className="admin-empty-cell">No branches yet — add one above.</li> : null}
          </ul>
        ) : null}
      </section>

      {sortedAlphabetically.length ? (
        <section className="admin-php-table-panel">
          <div className="admin-php-panel-head"><h2>Alphabetical (reference only)</h2></div>
          <div className="admin-branch-chip-row">
            {sortedAlphabetically.map((branch) => (
              <span className="admin-branch-chip" key={branch.id}>{branch.name}</span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
