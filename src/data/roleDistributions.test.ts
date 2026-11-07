import { describe, expect, it } from 'vitest';

import { ensureRoleDistributions } from './roleDistributions';

function cleanValue(value: unknown) {
  if (value === null || value === undefined || value === '' || value === '-') {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

describe('ensureRoleDistributions', () => {
  it('builds and caches stat and filter distributions for a role', () => {
    const statDistributionCache = new Map();
    const filterDistributionCache = new Map();
    const mergedData = [
      {
        Position: 'STC',
        'NP-xG/90': '0.10',
        'Pas %': '70.00',
        'Shot/90': '1.20',
        'Poss Lost/90': '9.00'
      },
      {
        Position: 'STC',
        'NP-xG/90': '0.30',
        'Pas %': '80.00',
        'Shot/90': '1.60',
        'Poss Lost/90': '7.00'
      },
      {
        Position: 'GK',
        'NP-xG/90': '0.01',
        'Pas %': '65.00',
        'Shot/90': '0.00',
        'Poss Lost/90': '4.00'
      }
    ];

    const result = ensureRoleDistributions({
      cleanValue,
      filterDistributionCache,
      keyStats: ['NP-xG/90', 'Pas %'],
      mergedData,
      role: 'STC',
      statDistributionCache
    });

    expect(result.statDist['NP-xG/90']).toEqual(
      expect.objectContaining({
        iqr: expect.any(Number),
        median: expect.any(Number)
      })
    );
    expect(result.filterDist['Shot/90']).toEqual({
      max: 1.6,
      min: 1.2,
      values: [1.2, 1.6]
    });
    expect(statDistributionCache.get('STC')).toBe(result.statDist);
    expect(filterDistributionCache.get('STC')).toBe(result.filterDist);
  });

  it('reuses existing cached distributions', () => {
    const statDist = { foo: { median: 1 } };
    const filterDist = { bar: { max: 2, min: 1, values: [1, 2] } };
    const statDistributionCache = new Map([['STC', statDist]]);
    const filterDistributionCache = new Map([['STC', filterDist]]);

    const result = ensureRoleDistributions({
      cleanValue,
      filterDistributionCache,
      keyStats: ['NP-xG/90'],
      mergedData: [{ Position: 'STC', 'NP-xG/90': '0.20' }],
      role: 'STC',
      statDistributionCache
    });

    expect(result.statDist).toBe(statDist);
    expect(result.filterDist).toBe(filterDist);
  });
});
