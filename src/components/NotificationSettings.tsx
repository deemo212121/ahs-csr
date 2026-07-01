'use client';

import { useEffect, useState } from 'react';
import { Settings2, Volume2, VolumeX } from 'lucide-react';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationSettings,
  saveNotificationSettings,
  type NotificationCategory,
  type NotificationSettings as NotificationSettingsValue,
} from '@/lib/notifications/settings';
import { previewNotificationSound } from '@/lib/notifications/sounds';

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  verify: 'New Tickets',
  messages: 'Messages',
  calls: 'Call Queue',
};

export function NotificationSettings({ availableRegions = [] }: { availableRegions?: string[] }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<NotificationSettingsValue>(DEFAULT_NOTIFICATION_SETTINGS);

  useEffect(() => {
    setSettings(getNotificationSettings());
  }, []);

  function update(next: Partial<NotificationSettingsValue>) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    saveNotificationSettings(merged);
  }

  function toggleCategory(category: NotificationCategory) {
    update({ categories: { ...settings.categories, [category]: !settings.categories[category] } });
  }

  function toggleRegion(region: string) {
    const current = settings.filterRegions;
    const next = current.includes(region)
      ? current.filter((r) => r !== region)
      : [...current, region];
    // If all regions are individually selected, normalise back to "all" (empty array).
    const nextNorm = next.length === availableRegions.length ? [] : next;
    update({ filterRegions: nextNorm });
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

          {availableRegions.length > 0 ? (
            <div className="notification-settings-filter-section">
              <span className="notification-settings-filter-label">Branch / Region Filter</span>
              <div className="notification-settings-filter-list">
                <label>
                  <input
                    checked={settings.filterRegions.length === 0}
                    onChange={() => update({ filterRegions: [] })}
                    type="checkbox"
                  />
                  <span>All branches</span>
                </label>
                {availableRegions.map((region) => (
                  <label key={region}>
                    <input
                      checked={settings.filterRegions.includes(region)}
                      onChange={() => toggleRegion(region)}
                      type="checkbox"
                    />
                    <span>{region}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
