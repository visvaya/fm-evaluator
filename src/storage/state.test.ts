// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '@/config/settingsModel';

import { clearAllState, loadUIStateSync, saveUIState } from './state';

// Mock the Dexie db module – we test localStorage path only (sync)
vi.mock('./db', () => ({
  clearAll: vi.fn(() => Promise.resolve()),
  loadUIStateDb: vi.fn(() => Promise.resolve(null)),
  saveUIStateDb: vi.fn(() => Promise.resolve())
}));

const STATE_KEY = 'fm24-evaluator-state-v1';
const SETTINGS_KEY = 'fm24-evaluator-settings-v1';
const POSSESSION_KEY = 'fm24-evaluator-possession-v1';
const REMEMBER_LANG_KEY = 'fm24-evaluator-remember-language-choice';

describe('storage/state', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveUIState', () => {
    it('should save state to localStorage', () => {
      const partial = {
        activeFilters: { position: 'MC' },
        columnOrder: ['basic_name', 'basic_club'],
        columnWidths: { basic_name: 200 },
        currentSort: { dir: 'asc', key: 'basic_name' },
        hiddenColumns: ['basic_dob'],
        pinnedColumns: ['basic_name'],
        positionFilterMode: 'and' as const,
        possessionMap: [['Manchester', 55]] as [string, number][],
        rememberLanguageChoice: true,
        roleFiltersEnabled: true,
        rowsPerPage: 25
      };

      const appSettings = {
        ...defaultSettings,
        maxBeeswarmPlayers: 100,
        minMins: 500,
        normalizeAttr: true,
        normalizeStat: false,
        normalizeTotal: true,
        penaltyXGFactor: 0.5,
        percentile: 90
      };

      saveUIState(partial, appSettings, null);

      const savedState = JSON.parse(localStorage.getItem(STATE_KEY));
      expect(savedState.activeFilters).toEqual({ position: 'MC' });
      expect(savedState.hiddenColumns).toEqual(['basic_dob']);
      expect(savedState.rowsPerPage).toBe(25);
      expect(savedState.positionFilterMode).toBe('and');
      expect(savedState.rememberLanguageChoice).toBe(true);

      const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      expect(savedSettings.percentile).toBe(90);
      expect(savedSettings.minMins).toBe(500);

      const savedPossession = JSON.parse(localStorage.getItem(POSSESSION_KEY));
      expect(savedPossession.map).toEqual([['Manchester', 55]]);

      expect(localStorage.getItem(REMEMBER_LANG_KEY)).toBe('true');
    });

    it('should use defaults for missing partial fields', () => {
      saveUIState({}, { ...defaultSettings, percentile: 50 }, null);
      const state = JSON.parse(localStorage.getItem(STATE_KEY));
      expect(state.activeFilters).toEqual({});
      expect(state.hiddenColumns).toEqual([]);
      expect(state.pinnedColumns).toEqual([]);
      expect(state.roleFiltersEnabled).toBe(false);
      expect(state.rowsPerPage).toBe(50);
      expect(state.currentSort).toBeNull();
      expect(state.positionFilterMode).toBe('or');
    });

    it('should extract possession map from processor if not in partial', () => {
      const fakeProcessor = {
        teamPossessionMap: new Map([
          ['Arsenal', 58],
          ['Chelsea', 52]
        ])
      };
      saveUIState({}, { ...defaultSettings }, fakeProcessor);
      const state = JSON.parse(localStorage.getItem(STATE_KEY));
      expect(state.possessionMap).toEqual([
        ['Arsenal', 58],
        ['Chelsea', 52]
      ]);
    });
  });

  describe('loadUIStateSync', () => {
    it('should return null when no state saved', () => {
      expect(loadUIStateSync()).toBeNull();
    });

    it('should return parsed state from localStorage', () => {
      const state = { hiddenColumns: ['a'], rowsPerPage: 100 };
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
      const loaded = loadUIStateSync();
      expect(loaded!.rowsPerPage).toBe(100);
      expect(loaded!.hiddenColumns).toEqual(['a']);
    });

    it('should return null for corrupted JSON', () => {
      localStorage.setItem(STATE_KEY, '{invalid json');
      expect(loadUIStateSync()).toBeNull();
    });
  });

  describe('clearAllState', () => {
    it('should remove all state keys from localStorage', async () => {
      localStorage.setItem(STATE_KEY, 'x');
      localStorage.setItem(SETTINGS_KEY, 'y');
      localStorage.setItem(POSSESSION_KEY, 'z');
      localStorage.setItem(REMEMBER_LANG_KEY, 'true');

      await clearAllState();

      expect(localStorage.getItem(STATE_KEY)).toBeNull();
      expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
      expect(localStorage.getItem(POSSESSION_KEY)).toBeNull();
      expect(localStorage.getItem(REMEMBER_LANG_KEY)).toBeNull();
    });
  });
});
