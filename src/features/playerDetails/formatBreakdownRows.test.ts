import { describe, expect, it } from 'vitest';

import { formatBreakdownRows } from './formatBreakdownRows';

describe('formatBreakdownRows', () => {
  it('maps numeric, missing, and range-like legacy rows into breakdown rows', () => {
    const rows = formatBreakdownRows([
      { name: 'Acc', percentile: 79.84, score: 0.17, val: 12, weight: 0.0145 },
      { isMissing: true, name: 'Bal', rawValue: 'N/D', score: null, val: null, weight: 1.2 },
      { isRange: true, name: 'Fin', percentile: 'bad', score: '0.5', val: '10-12', weight: '0.2' }
    ]);

    expect(rows).toEqual([
      {
        chartValue: 12,
        isLow: undefined,
        isMissing: undefined,
        isRange: undefined,
        label: 'Acc',
        percentile: 79.8,
        rawValue: '12.00',
        score: 0.17,
        sourceKey: 'Acc',
        weight: '0.0145'
      },
      {
        chartValue: null,
        isLow: undefined,
        isMissing: true,
        isRange: undefined,
        label: 'Bal',
        percentile: null,
        rawValue: '–',
        score: null,
        sourceKey: 'Bal',
        weight: '1.20'
      },
      {
        chartValue: null,
        isLow: undefined,
        isMissing: undefined,
        isRange: true,
        label: 'Fin',
        percentile: null,
        rawValue: '10-12',
        score: 0.5,
        sourceKey: 'Fin',
        weight: '0.2'
      }
    ]);
  });
});
