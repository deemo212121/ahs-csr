'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type BranchCheckboxDropdownProps = {
  label?: string;
  branches: string[];
  selectedBranches: string[];
  onChange: (branches: string[]) => void;
};

function cleanBranches(branches: string[]) {
  return Array.from(new Set(branches.map((branch) => branch.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function BranchCheckboxDropdown({
  label = 'Branches',
  branches,
  selectedBranches,
  onChange,
}: BranchCheckboxDropdownProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 360, maxHeight: 420 });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const options = useMemo(() => cleanBranches(branches), [branches]);
  const selectedSet = useMemo(() => new Set(selectedBranches), [selectedBranches]);
  const allSelected = options.length > 0 && selectedBranches.length === options.length;

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((branch) => branch.toLowerCase().includes(term));
  }, [options, search]);

  const summary = useMemo(() => {
    if (!options.length) return 'No branches available';
    if (allSelected) return 'All Branches';
    if (!selectedBranches.length) return 'No branches selected';
    if (selectedBranches.length === 1) return selectedBranches[0];
    return `${selectedBranches.length} branches selected`;
  }, [allSelected, options.length, selectedBranches]);

  const selectedPreview = useMemo(() => selectedBranches.slice(0, 3), [selectedBranches]);
  const hiddenSelectedCount = Math.max(0, selectedBranches.length - selectedPreview.length);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setSearch('');
      return;
    }

    const updateMenuPosition = () => {
      const rect = toggleRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportPadding = 16;
      const gap = 10;
      const preferredWidth = Math.max(rect.width, 390);
      const width = Math.min(preferredWidth, window.innerWidth - viewportPadding * 2);
      const maxLeft = window.innerWidth - width - viewportPadding;
      const left = Math.max(viewportPadding, Math.min(rect.left, maxLeft));
      const top = rect.bottom + gap;
      const maxHeight = Math.max(280, Math.min(460, window.innerHeight - top - viewportPadding));

      setMenuPosition({ top, left, width, maxHeight });
    };

    updateMenuPosition();
    const frame = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    const focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 50);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(focusTimer);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const toggleAll = () => onChange(allSelected ? [] : options);

  const toggleBranch = (branch: string) => {
    if (selectedSet.has(branch)) {
      onChange(cleanBranches(selectedBranches.filter((item) => item !== branch)).filter((item) => options.includes(item)));
      return;
    }

    onChange(cleanBranches([...selectedBranches, branch]).filter((item) => options.includes(item)));
  };

  const menu = open ? (
    <div
      className="branch-dropdown-menu branch-dropdown-menu-portal"
      ref={menuRef}
      style={{
        left: `${menuPosition.left}px`,
        maxHeight: `${menuPosition.maxHeight}px`,
        top: `${menuPosition.top}px`,
        width: `${menuPosition.width}px`,
      }}
    >
      <div className="branch-dropdown-menu-head">
        <div>
          <strong>Branch Filter</strong>
          <span>{allSelected ? `${options.length} branches included` : `${selectedBranches.length} of ${options.length} selected`}</span>
        </div>
        <button aria-label="Close branch filter" onClick={() => setOpen(false)} type="button">×</button>
      </div>

      <div className="branch-search-box">
        <input
          aria-label="Search branches"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search branch..."
          ref={searchInputRef}
          type="search"
          value={search}
        />
      </div>

      <div className="branch-menu-actions">
        <label className="branch-checkbox-row branch-checkbox-row-all">
          <input
            checked={allSelected}
            onChange={toggleAll}
            type="checkbox"
          />
          <span>All Branches</span>
        </label>
      </div>

      {!allSelected && selectedPreview.length ? (
        <div className="branch-selected-preview">
          {selectedPreview.map((branch) => <span key={branch}>{branch}</span>)}
          {hiddenSelectedCount ? <span>+{hiddenSelectedCount} more</span> : null}
        </div>
      ) : null}

      <div className="branch-checkbox-list" style={{ maxHeight: `${Math.max(120, menuPosition.maxHeight - 190)}px` }}>
        {filteredOptions.length ? filteredOptions.map((branch) => {
          const checked = selectedSet.has(branch);
          return (
            <label className="branch-checkbox-row" key={branch}>
              <input
                checked={checked}
                onChange={() => toggleBranch(branch)}
                type="checkbox"
              />
              <span>{branch}</span>
            </label>
          );
        }) : (
          <div className="branch-dropdown-empty">No branch matches your search.</div>
        )}
      </div>

      <div className="branch-dropdown-foot">
        Your checked branches are saved automatically after reload.
      </div>
    </div>
  ) : null;

  return (
    <div className="branch-dropdown-field" ref={wrapperRef}>
      <span className="branch-dropdown-label">{label}</span>
      <button
        aria-expanded={open}
        className={`branch-dropdown-toggle${open ? ' is-open' : ''}`}
        disabled={!options.length}
        onClick={() => setOpen((value) => !value)}
        ref={toggleRef}
        type="button"
      >
        <span className="branch-toggle-main">
          <b>{summary}</b>
          <small>{allSelected ? 'Showing every branch' : selectedBranches.length ? 'Custom saved selection' : 'No branches are checked'}</small>
        </span>
        <span className="branch-toggle-side">
          <strong>{allSelected ? 'All' : selectedBranches.length}</strong>
          <i aria-hidden="true">⌄</i>
        </span>
      </button>

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
