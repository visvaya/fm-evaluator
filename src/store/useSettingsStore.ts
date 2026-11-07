import { create } from 'zustand';

import { defaultSettings, type AppSettings } from '../config/settingsModel';

interface SettingsStore {
  applySettings: (patch: Partial<AppSettings>) => void;
  initFromLoaded: (loaded: Partial<AppSettings>) => void;
  resetSettings: () => void;
  settings: AppSettings;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  applySettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  initFromLoaded: (loaded) => set((s) => ({ settings: { ...s.settings, ...loaded } })),
  resetSettings: () => set({ settings: { ...defaultSettings } }),
  settings: { ...defaultSettings }
}));

/**
 * Effective minimum-minutes threshold: the explicit user setting when set,
 * otherwise the adaptive threshold computed from the imported data.
 */
export function getEffectiveMinMins(): number {
  const { adaptiveMinMins, minMins } = useSettingsStore.getState().settings;
  return minMins === null ? adaptiveMinMins : minMins;
}
