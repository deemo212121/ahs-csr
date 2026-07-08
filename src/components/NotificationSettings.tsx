'use client';

import { useEffect, useState } from 'react';
import { Check, Settings2, Volume2, VolumeX } from 'lucide-react';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationSettings,
  saveNotificationSettings,
  type NotificationCategory,
  type NotificationSettings as NotificationSettingsValue,
} from '@/lib/notifications/settings';
import { previewNotificationSound } from '@/lib/notifications/sounds';
import { useBranches } from '@/lib/useBranches';
import { useBranchFilter } from '@/lib/useBranchFilter';
import { BranchCheckboxDropdown } from '@/components/BranchCheckboxDropdown';
import { PushNotificationToggle } from '@/components/PushNotificationToggle';

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  verify: 'New Tickets',
  messages: 'Messages',
  calls: 'Call Queue',
};

export function NotificationSettings() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<NotificationSettingsValue>(DEFAULT_NOTIFICATION_SETTINGS);
  const { selectedBranches, applyBranches } = useBranchFilter();
  const { branches: allBranches } = useBranches();
  const [pendingBranches, setPendingBranches] = useState(selectedBranches);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    setSettings(getNotificationSettings());
  }, []);

  useEffect(() => {
    setPendingBranches(selectedBranches);
  }, [selectedBranches]);

  // An empty selection and "every branch checked" are the same saved state
  // in this app (see useBranchFilter's normalize()) — comparing them as
  // literally different values here was what made "Save filter" with
  // nothing checked immediately flip back to "Unsaved changes": it saves
  // correctly, but the just-saved value comes back as "all branches" (not
  // empty), which no longer matched the still-empty pending selection.
  function dirtyKey(list: string[]) {
    return (list.length === 0 || list.length === allBranches.length) ? '__all__' : [...list].sort().join('|');
  }
  const isDirty = dirtyKey(pendingBranches) !== dirtyKey(selectedBranches);

  async function saveBranches() {
    setSaveState('saving');
    try {
      await applyBranches(pendingBranches);
      setSaveState('saved');
      window.setTimeout(() => setSaveState((current) => (current === 'saved' ? 'idle' : current)), 2000);
    } catch {
      setSaveState('error');
    }
  }

  function update(next: Partial<NotificationSettingsValue>) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    saveNotificationSettings(merged);
  }

  function toggleCategory(category: NotificationCategory) {
    update({ categories: { ...settings.categories, [category]: !settings.categories[category] } });
  }

  return (
    <div className="agent-popover-anchor">
      <button
        aria-expanded={open}
        aria-label="Notification settings"
        className="agent-icon-btn"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Settings2 size={16} />
      </button>
      {open ? (
        <div className="notification-settings-panel">
          <div className="agent-popover-head">
            <strong>Notification Settings</strong>
          </div>

          <label className="notification-settings-row notification-settings-master">
            <span>All notification sounds</span>
            <input
              checked={settings.masterEnabled}
              onChange={() => update({ masterEnabled: !settings.masterEnabled })}
              type="checkbox"
            />
          </label>

          <div className="notification-settings-row notification-settings-push-row">
            <PushNotificationToggle />
          </div>

          <div className="notification-settings-volume">
            {settings.volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <input
              aria-label="Notification volume"
              max={1}
              min={0}
              onChange={(event) => update({ volume: Number(event.target.value) })}
              step={0.05}
              type="range"
              value={settings.volume}
            />
          </div>

          {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((category) => (
            <div className="notification-settings-row" key={category}>
              <label>
                <input
                  checked={settings.categories[category]}
                  disabled={!settings.masterEnabled}
                  onChange={() => toggleCategory(category)}
                  type="checkbox"
                />
                <span>{CATEGORY_LABELS[category]}</span>
              </label>
              <button
                className="notification-settings-test-btn"
                disabled={!settings.masterEnabled}
                onClick={() => previewNotificationSound(category, settings.volume || 0.6)}
                type="button"
              >
                Test
              </button>
            </div>
          ))}

          <div className="notification-settings-filter-section">
            <span className="notification-settings-filter-label">Branch / Region Filter</span>
            <p className="notification-settings-filter-hint">
              This is your primary branch filter — it controls Tickets, Verify, Messages, and Calls / Call History too.
            </p>
            <BranchCheckboxDropdown branches={allBranches} selectedBranches={pendingBranches} onChange={setPendingBranches} />
            <div className="notification-settings-filter-save-row">
              <button
                className="notification-settings-save-btn"
                disabled={!isDirty || saveState === 'saving'}
                onClick={() => void saveBranches()}
                type="button"
              >
                {saveState === 'saving' ? 'Saving...' : <><Check size={14} /> Save filter</>}
              </button>
              {saveState === 'saved' ? <span className="notification-settings-save-status success">Saved</span> : null}
              {saveState === 'error' ? <span className="notification-settings-save-status error">Couldn&apos;t save — try again</span> : null}
              {isDirty && saveState === 'idle' ? <span className="notification-settings-save-status">Unsaved changes</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
