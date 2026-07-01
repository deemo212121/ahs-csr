// Shared notification-preferences storage, read by both the settings panel
// UI and the feed hook (which needs to know whether to actually play a
// sound). Same approach as the rest of this app's client state: one JSON
// blob in localStorage, no backend.

export type NotificationCategory = 'verify' | 'messages' | 'calls';

export type NotificationSettings = {
  masterEnabled: boolean;
  volume: number; // 0-1
  categories: Record<NotificationCategory, boolean>;
  // Empty array = no filter (receive all regions). Non-empty = only listed regions.
  filterRegions: string[];
};

const STORAGE_KEY = 'ushs-notification-settings';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  masterEnabled: true,
  volume: 0.6,
  categories: { verify: true, messages: true, calls: true },
  filterRegions: [],
};

export function getNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      masterEnabled: parsed.masterEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.masterEnabled,
      volume: typeof parsed.volume === 'number' ? parsed.volume : DEFAULT_NOTIFICATION_SETTINGS.volume,
      categories: { ...DEFAULT_NOTIFICATION_SETTINGS.categories, ...(parsed.categories ?? {}) },
      filterRegions: Array.isArray(parsed.filterRegions) ? parsed.filterRegions : [],
    };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export function saveNotificationSettings(settings: NotificationSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('ushs-notification-settings-changed', { detail: settings }));
}

export function effectiveVolume(settings: NotificationSettings, category: NotificationCategory) {
  if (!settings.masterEnabled || !settings.categories[category]) return 0;
  return settings.volume;
}
