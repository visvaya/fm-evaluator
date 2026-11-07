import { describe, expect, it } from 'vitest';

import { getAttrWarnings, getStatWarnings } from './warningsModel';

describe('warningsModel', () => {
  it('derives attribute warnings for missing and ranged values', () => {
    const warnings = getAttrWarnings([
      {
        chartValue: null,
        isMissing: true,
        label: 'Acc',
        percentile: null,
        rawValue: '–',
        score: null,
        sourceKey: 'Acc',
        weight: '0.1'
      },
      {
        chartValue: null,
        isRange: true,
        label: 'Fin',
        percentile: null,
        rawValue: '10-12',
        score: null,
        sourceKey: 'Fin',
        weight: '0.1'
      }
    ]);

    expect(warnings).toHaveLength(2);
  });

  it('derives statistical warnings for low minutes and missing metrics', () => {
    const warnings = getStatWarnings({ isLow: true } as never, [
      {
        chartValue: null,
        isMissing: true,
        isLow: false,
        label: 'NP-xG/90',
        percentile: null,
        rawValue: '–',
        score: null,
        sourceKey: 'NP-xG/90',
        weight: '1.1'
      }
    ]);

    expect(warnings).toHaveLength(2);
  });
});
