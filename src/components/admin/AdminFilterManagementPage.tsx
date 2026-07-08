'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CalendarDays, GripVertical, ListFilter, Plus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { fetchJsonWithFirebase } from '@/lib/auth/client';

type BranchRow = { id: string; name: string; sort_order: number; is_listed: boolean };

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

// A branch dragged from Unlisted into Listed becomes selectable in every
// CSR/manager/team leader's own branch filter checklist immediately — same
// for the reverse. This is the "connected to CSR filters" behavior: what's
// in the Listed column here is exactly what shows up on their end.
export function AdminFilterManagementPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJsonWithFirebase<{ branches?: BranchRow[] }>(user, '/api/branches?all=true');
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

  // New branches land in Listed by default (matches the table's own
  // default) — drag it into Unlisted afterward if it shouldn't show up yet.
  async function addBranch(event: FormEvent) {
    event.preventDefault();
    if (!user || !newName.trim()) return;
    setAdding(true);
    setNotice(null);
    try {
      await fetchJsonWithFirebase(user, '/api/branches', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNotice(`"${newName.trim()}" added — listed, and selectable in every branch filter.`);
      setNewName('');
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to add branch.');
    } finally {
      setAdding(false);
    }
  }

  const listed = [...branches].filter((b) => b.is_listed).sort((a, b) => a.sort_order - b.sort_order);
  const unlisted = [...branches].filter((b) => !b.is_listed).sort((a, b) => a.name.localeCompare(b.name));

  function handleDragStart(id: string) {
    setDragId(id);
  }

  // Live-reorders local state while dragging over another Listed row —
  // purely a display reorder; nothing is persisted until drop.
  function handleDragOverListedRow(overId: string) {
    if (!dragId || dragId === overId) return;
    const dragged = branches.find((b) => b.id === dragId);
    if (!dragged?.is_listed) return; // cross-column drags handle reorder on drop instead

    setBranches((current) => {
      const orderedIds = [...current]
        .filter((b) => b.is_listed)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((b) => b.id);
      const fromIndex = orderedIds.indexOf(dragId);
      const toIndex = orderedIds.indexOf(overId);
      if (fromIndex === -1 || toIndex === -1) return current;
      const nextOrder = [...orderedIds];
      const [moved] = nextOrder.splice(fromIndex, 1);
      nextOrder.splice(toIndex, 0, moved);
      const rank = new Map(nextOrder.map((id, index) => [id, index]));
      return current.map((b) => (rank.has(b.id) ? { ...b, sort_order: rank.get(b.id)! } : b));
    });
  }

  async function handleDropOnListed() {
    const id = dragId;
    setDragId(null);
    if (!user || !id) return;
    const branch = branches.find((b) => b.id === id);
    if (!branch) return;

    if (!branch.is_listed) {
      // Crossing over from Unlisted — append to the end of the listed set.
      const maxOrder = branches.filter((b) => b.is_listed).reduce((max, b) => Math.max(max, b.sort_order), -1);
      setBranches((current) =>
        current.map((b) => (b.id === id ? { ...b, is_listed: true, sort_order: maxOrder + 1 } : b)),
      );
      setSaving(true);
      setNotice(null);
      try {
        await fetchJsonWithFirebase(user, '/api/branches', {
          method: 'PATCH',
          body: JSON.stringify({ id, is_listed: true }),
        });
        setNotice(`"${branch.name}" is now listed — selectable in every branch filter.`);
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'Unable to list this branch.');
        await load();
      } finally {
        setSaving(false);
      }
      return;
    }

    // Already listed — a drag-over on some row already reordered local
    // state live; persist that order now.
    const order = [...branches].filter((b) => b.is_listed).sort((a, b) => a.sort_order - b.sort_order).map((b) => b.id);
    setSaving(true);
    try {
      await fetchJsonWithFirebase(user, '/api/branches', { method: 'PATCH', body: JSON.stringify({ order }) });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to save the new order.');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDropOnUnlisted() {
    const id = dragId;
    setDragId(null);
    if (!user || !id) return;
    const branch = branches.find((b) => b.id === id);
    if (!branch || !branch.is_listed) return;

    setBranches((current) => current.map((b) => (b.id === id ? { ...b, is_listed: false } : b)));
    setSaving(true);
    setNotice(null);
    try {
      await fetchJsonWithFirebase(user, '/api/branches', {
        method: 'PATCH',
        body: JSON.stringify({ id, is_listed: false }),
      });
      setNotice(`"${branch.name}" is now unlisted — hidden from every branch filter.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to unlist this branch.');
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-php-page">
      <AdminPageHero
        icon={<ListFilter size={34} />}
        title="Filter Management"
        subtitle="Drag a branch between Unlisted and Listed. Listed branches are exactly what shows up in every CSR/manager branch filter checklist."
      >
        <span className="admin-date-pill"><CalendarDays size={13} /> {saving ? 'Saving…' : 'Live'}</span>
      </AdminPageHero>

      <section className="admin-php-form-panel">
        <div className="admin-php-panel-head"><h2>Add New Branch</h2></div>
        <form className="admin-php-inline-form" onSubmit={addBranch}>
          <label>
            Branch Name
            <input onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Salt Lake City" required value={newName} />
          </label>
          <button disabled={adding} type="submit"><Plus size={17} /> {adding ? 'Adding...' : 'Add Branch'}</button>
        </form>
      </section>

      {loading ? <div className="admin-empty-state">Loading branches...</div> : null}
      {error ? <div className="login-alert">{error}</div> : null}
      {notice ? <p className="admin-php-notice">{notice}</p> : null}

      {!loading && !error ? (
        <div className="admin-filter-columns">
          <section
            className="admin-php-table-panel admin-filter-column"
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => void handleDropOnUnlisted()}
          >
            <div className="admin-php-panel-head">
              <h2>Unlisted</h2>
              <span>{unlisted.length}</span>
            </div>
            <ul className="admin-branch-drag-list">
              {unlisted.map((branch) => (
                <li
                  className={`admin-branch-drag-row ${dragId === branch.id ? 'dragging' : ''}`}
                  draggable
                  key={branch.id}
                  onDragStart={() => handleDragStart(branch.id)}
                >
                  <span className="admin-branch-drag-handle" aria-hidden="true"><GripVertical size={16} /></span>
                  <span className="admin-branch-drag-name">{branch.name}</span>
                </li>
              ))}
              {!unlisted.length ? <li className="admin-empty-cell">Drop a branch here to unlist it.</li> : null}
            </ul>
          </section>

          <section
            className="admin-php-table-panel admin-filter-column"
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => void handleDropOnListed()}
          >
            <div className="admin-php-panel-head">
              <h2>Listed</h2>
              <span>{listed.length}</span>
            </div>
            <ul className="admin-branch-drag-list">
              {listed.map((branch) => (
                <li
                  className={`admin-branch-drag-row ${dragId === branch.id ? 'dragging' : ''}`}
                  draggable
                  key={branch.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDragOverListedRow(branch.id);
                  }}
                  onDragStart={() => handleDragStart(branch.id)}
                >
                  <span className="admin-branch-drag-handle" aria-hidden="true"><GripVertical size={16} /></span>
                  <span className="admin-branch-drag-name">{branch.name}</span>
                </li>
              ))}
              {!listed.length ? <li className="admin-empty-cell">Drop a branch here to list it.</li> : null}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
