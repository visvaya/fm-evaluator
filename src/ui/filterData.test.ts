// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '@/config/settingsModel';
import { store } from '@/store/tableStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTableStore } from '@/store/useTableStore';

import { getFilteredData, getSortedData } from './filterData';

vi.mock('@/computing/ldc', () => ({
  getPlayerLeagueMultiplier: (player: { ldcMultiplier?: number }) => player.ldcMultiplier ?? 1
}));

function parseNumber(value: unknown): null | number {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null;
  }
  if (value === '') {
    return null;
  }

  const parsed = Number(String(value).replaceAll(/[^\d.-]/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
}

function installProcessor(overrides: Record<string, unknown> = {}) {
  (window as any).processor = {
    _parseNumber: parseNumber,
    calculatedScores: [],
    cleanValue: parseNumber,
    getMinMins: () => null,
    getNumericValue: parseNumber,
    getTeamPossession: (club: string) => (club === 'Owned FC' ? 56 : null),
    ...overrides
  };
}

describe('filterData', () => {
  beforeEach(() => {
    store.activeFilters = {};
    store.currentSort = { col: 'totalScore', dir: 'desc' };
    store.filterDirty = true;
    store.filteredDataCache = [];
    store.positionFilterMode = 'or';
    store.roleFiltersEnabled = false;
    store.virtualState = { enabled: false, end: 0, start: 99, total: 0 };
    useSettingsStore.setState({ settings: { ...defaultSettings } });
    installProcessor();
    useTableStore.setState({ data: [] });
  });

  afterEach(() => {
    (window as any).processor = undefined;
    useTableStore.setState({ data: [] });
  });

  it('applies search, role, minutes and LDC filters before caching results', () => {
    installProcessor({
      calculatedScores: [
        { ldcMultiplier: 3, mins: '900', name: 'Álvaro', passesFilters: true },
        { ldcMultiplier: 6, mins: '900', name: 'Alvaro B', passesFilters: true },
        { ldcMultiplier: 3, mins: '120', name: 'Álvaro C', passesFilters: true },
        { ldcMultiplier: 3, mins: '900', name: 'Álvaro D', passesFilters: false }
      ]
    });
    useSettingsStore
      .getState()
      .applySettings({ ldcFilterEnabled: true, ldcFilterMax: 5, ldcFilterMin: 2, minMins: 500 });
    store.activeFilters = { name: 'alvaro' };
    store.roleFiltersEnabled = true;

    const filtered = getFilteredData();

    expect(filtered.map((player) => player.name)).toEqual(['Álvaro']);
    expect(store.filterDirty).toBe(false);
    expect(store.filteredDataCache).toBe(filtered);
    expect(store.virtualState).toMatchObject({ end: 1, start: 0 });
  });

  it('matches money ranges using parsed range bounds', () => {
    installProcessor({
      calculatedScores: [
        { name: 'inside', value: '100 - 200' },
        { name: 'too cheap', value: '50 - 200' },
        { name: 'too expensive', value: '100 - 250' }
      ]
    });
    store.activeFilters = { value: { max: 200, min: 100 } };

    expect(getFilteredData().map((player) => player.name)).toEqual(['inside']);
  });

  it('supports position OR, AND and unknown-position filtering', () => {
    installProcessor({
      calculatedScores: [
        { name: 'keeper', positionArray: ['GK'], pos2Array: [] },
        { name: 'hybrid', positionArray: ['GK'], pos2Array: ['ST (C)'] },
        { name: 'unknown', positionArray: ['XYZ'], pos2Array: [] }
      ]
    });

    store.activeFilters = { position: ['GK', 'ST (C)'] };
    expect(getFilteredData().map((player) => player.name)).toEqual(['keeper', 'hybrid']);

    store.filterDirty = true;
    store.positionFilterMode = 'and';
    expect(getFilteredData().map((player) => player.name)).toEqual(['hybrid']);

    store.filterDirty = true;
    store.positionFilterMode = 'or';
    store.activeFilters = { position: ['Inna/nieznana'] };
    expect(getFilteredData().map((player) => player.name)).toEqual(['unknown']);
  });

  it('sorts numeric value and best-role columns through their legacy normalizers', () => {
    installProcessor();

    store.currentSort = { col: 'value', dir: 'desc' };
    expect(
      getSortedData([
        { name: 'low', value: '10' },
        { name: 'high', value: '30' }
      ]).map((player) => player.name)
    ).toEqual(['high', 'low']);

    store.currentSort = { col: 'bestRoleTotal', dir: 'asc' };
    expect(
      getSortedData([
        { bestRoleTotal: { score: 18 }, name: 'object' },
        { bestRoleTotal: '12.5 Poacher', name: 'string' }
      ]).map((player) => player.name)
    ).toEqual(['string', 'object']);
  });

  it('prefers table store rows over legacy calculatedScores when filtering', () => {
    installProcessor({
      calculatedScores: [{ mins: '900', name: 'legacy row', passesFilters: true }]
    });
    useTableStore.setState({
      data: [{ mins: '900', name: 'store row', passesFilters: true }] as any[]
    });
    store.activeFilters = { name: 'store' };

    expect(getFilteredData().map((player) => player.name)).toEqual(['store row']);
  });
});
