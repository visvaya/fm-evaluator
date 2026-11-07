import { beforeEach, describe, expect, it } from 'vitest';

import { defaultSettings } from '@/config/settingsModel';

import { useSettingsStore } from './useSettingsStore';

beforeEach(() => {
  useSettingsStore.setState({ settings: { ...defaultSettings } });
});

describe('useSettingsStore', () => {
  describe('initial state', () => {
    it('starts with defaultSettings', () => {
      expect(useSettingsStore.getState().settings).toEqual(defaultSettings);
    });
  });

  describe('applySettings', () => {
    it('merges patch into existing settings (immutable)', () => {
      const before = useSettingsStore.getState().settings;

      useSettingsStore.getState().applySettings({ percentile: 80 });

      const after = useSettingsStore.getState().settings;
      expect(after.percentile).toBe(80);
      expect(after).not.toBe(before);
    });

    it('does not mutate unrelated fields', () => {
      useSettingsStore.getState().applySettings({ percentile: 80 });
      const settings = useSettingsStore.getState().settings;

      expect(settings.minMins).toBe(defaultSettings.minMins);
      expect(settings.normalizeAttr).toBe(defaultSettings.normalizeAttr);
      expect(settings.pAdjEnabled).toBe(defaultSettings.pAdjEnabled);
    });

    it('supports partial updates with multiple fields', () => {
      useSettingsStore.getState().applySettings({ minMins: 300, percentile: 85 });
      const settings = useSettingsStore.getState().settings;

      expect(settings.percentile).toBe(85);
      expect(settings.minMins).toBe(300);
    });

    it('accepts null for minMins and adaptiveMinMins', () => {
      useSettingsStore.getState().applySettings({ adaptiveMinMins: 270, minMins: 300 });
      useSettingsStore.getState().applySettings({ adaptiveMinMins: null, minMins: null });

      const settings = useSettingsStore.getState().settings;
      expect(settings.minMins).toBeNull();
      expect(settings.adaptiveMinMins).toBeNull();
    });
  });

  describe('resetSettings', () => {
    it('restores all fields to defaultSettings', () => {
      useSettingsStore
        .getState()
        .applySettings({ minMins: 999, normalizeTotal: true, percentile: 50 });
      useSettingsStore.getState().resetSettings();

      expect(useSettingsStore.getState().settings).toEqual(defaultSettings);
    });

    it('produces a new object reference', () => {
      const before = useSettingsStore.getState().settings;
      useSettingsStore.getState().resetSettings();

      expect(useSettingsStore.getState().settings).not.toBe(before);
    });
  });

  describe('initFromLoaded', () => {
    it('merges loaded partial into current settings', () => {
      useSettingsStore.getState().initFromLoaded({ percentile: 75, normalizeTotal: true });
      const settings = useSettingsStore.getState().settings;

      expect(settings.percentile).toBe(75);
      expect(settings.normalizeTotal).toBe(true);
      expect(settings.minMins).toBe(defaultSettings.minMins);
    });

    it('does not overwrite unspecified fields', () => {
      useSettingsStore.getState().applySettings({ pAdjEnabled: false });
      useSettingsStore.getState().initFromLoaded({ percentile: 75 });

      expect(useSettingsStore.getState().settings.pAdjEnabled).toBe(false);
    });

    it('handles empty object without error', () => {
      expect(() => useSettingsStore.getState().initFromLoaded({})).not.toThrow();
      expect(useSettingsStore.getState().settings).toEqual(defaultSettings);
    });
  });
});
