'use client';

import { useEffect, useMemo, useState } from 'react';

function cleanBranches(branches: string[]) {
  return Array.from(new Set(branches.map((branch) => branch.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function sameBranches(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

function storedBranches(value: unknown) {
  if (Array.isArray(value)) {
    return {
      branches: value.filter((branch): branch is string => typeof branch === 'string'),
      hasSavedSelection: value.length > 0,
    };
  }

  if (value && typeof value === 'object' && Array.isArray((value as { branches?: unknown }).branches)) {
    return {
      branches: (value as { branches: unknown[] }).branches.filter((branch): branch is string => typeof branch === 'string'),
      hasSavedSelection: true,
    };
  }

  return { branches: [], hasSavedSelection: false };
}

export function usePersistentBranchFilter(storageKey: string, availableBranches: string[], defaultBranches: string[] = []) {
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasSavedSelection, setHasSavedSelection] = useState(false);

  const cleanAvailableBranches = useMemo(() => cleanBranches(availableBranches), [availableBranches]);
  const cleanDefaultBranches = useMemo(
    () => cleanBranches(defaultBranches).filter((branch) => cleanAvailableBranches.includes(branch)),
    [cleanAvailableBranches, defaultBranches],
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const stored = storedBranches(parsed);
        setSelectedBranches(cleanBranches(stored.branches));
        setHasSavedSelection(stored.hasSavedSelection);
      } else {
        setSelectedBranches([]);
        setHasSavedSelection(false);
      }
    } catch {
      setSelectedBranches([]);
      setHasSavedSelection(false);
    } finally {
      setLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ version: 2, branches: selectedBranches }));
  }, [loaded, selectedBranches, storageKey]);

  useEffect(() => {
    if (!loaded || !cleanAvailableBranches.length) return;
    setSelectedBranches((current) => {
      if (!hasSavedSelection && current.length === 0) {
        return cleanDefaultBranches.length ? cleanDefaultBranches : cleanAvailableBranches;
      }

      const valid = cleanBranches(current).filter((branch) => cleanAvailableBranches.includes(branch));
      return sameBranches(valid, current) ? current : valid;
    });
  }, [cleanAvailableBranches, cleanDefaultBranches, hasSavedSelection, loaded]);

  return { selectedBranches, setSelectedBranches };
}
