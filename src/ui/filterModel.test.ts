import { describe, expect, it, vi } from 'vitest';

import {
  buildRangeFilterValue,
  buildSearchFilterValue,
  isLdcMatchedLeague,
  setSelectedValues,
  sortPositionsIntelligently,
  toggleFilterValue
} from './filterModel';

vi.mock('@/computing/ldcMappings', () => ({
  loadLeagueMappings: () => ({
    EkstraklasaAlias: 'Ekstraklasa'
  })
}));

describe('filterModel', () => {
  it('normalizes search filter values and drops empty queries', () => {
    expect(buildSearchFilterValue('  Richardson ')).toBe('richardson');
    expect(buildSearchFilterValue('   ')).toBeNull();
  });

  it('builds range filter values from text inputs', () => {
    expect(buildRangeFilterValue('10', '20')).toEqual({ max: 20, min: 10 });
    expect(buildRangeFilterValue('', '5')).toEqual({ max: 5 });
    expect(buildRangeFilterValue('', '')).toBeNull();
  });

  it('toggles checkbox values without mutating the previous array', () => {
    const current = ['Legia'];

    expect(toggleFilterValue(current, 'Lech')).toEqual(['Legia', 'Lech']);
    expect(toggleFilterValue(current, 'Legia')).toEqual([]);
    expect(current).toEqual(['Legia']);
  });

  it('sets multiple visible values in and out of the selected set', () => {
    expect(setSelectedValues(['A'], ['B', 'C'], true)).toEqual(['A', 'B', 'C']);
    expect(setSelectedValues(['A', 'B', 'C'], ['B', 'C'], false)).toEqual(['A']);
  });

  it('sorts standard positions before unknown positions', () => {
    expect(sortPositionsIntelligently(['XYZ', 'ST (C)', 'GK', 'Inna/nieznana'])).toEqual([
      'GK',
      'ST (C)',
      'Inna/nieznana',
      'XYZ'
    ]);
  });

  it('detects LDC matched leagues through settings, normalized names and mappings', () => {
    expect(isLdcMatchedLeague('Ekstraklasa', { leagues: [{ name: 'Ekstraklasa' }] })).toBe(true);
    expect(isLdcMatchedLeague('EkstraklasaAlias', { leagues: [] })).toBe(true);
    expect(isLdcMatchedLeague('Unmapped League', { leagues: [] })).toBe(false);
  });
});
