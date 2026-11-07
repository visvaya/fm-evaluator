// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  createPlayerDetailsComparisonRuntime,
  getComparisonContextData,
  getFilterDistribution,
  getFilterLimitRange
} from './comparisonRuntime';

const cleanValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

describe('comparisonRuntime', () => {
  it('filters comparison context by position and minimum minutes for stat-like views', () => {
    const runtime = createPlayerDetailsComparisonRuntime({
      cleanValue,
      mergedData: [
        { Mins: 2200, Position: 'STC', uid: 'a' },
        { Mins: 60, Position: 'STC', uid: 'b' },
        { Mins: 1800, Position: 'GK', uid: 'c' }
      ],
      minMins: 90
    });

    expect(
      getComparisonContextData({
        currentPosition: 'STC',
        kind: 'stat',
        runtime
      })
    ).toEqual([{ Mins: 2200, Position: 'STC', uid: 'a' }]);
  });

  it('keeps low-minute rows for attribute views and handles GK position grouping', () => {
    const runtime = createPlayerDetailsComparisonRuntime({
      cleanValue,
      mergedData: [
        { Mins: 20, Position: 'STC', uid: 'a' },
        { Mins: 1800, Position: 'GK', uid: 'b' },
        { Mins: 1700, Position: 'DC', uid: 'c' }
      ],
      minMins: 90
    });

    expect(
      getComparisonContextData({
        currentPosition: 'STC',
        kind: 'attribute',
        runtime
      })
    ).toEqual([
      { Mins: 20, Position: 'STC', uid: 'a' },
      { Mins: 1700, Position: 'DC', uid: 'c' }
    ]);

    expect(
      getComparisonContextData({
        currentPosition: 'GK',
        kind: 'stat',
        runtime
      })
    ).toEqual([{ Mins: 1800, Position: 'GK', uid: 'b' }]);
  });

  it('reads filter distributions and falls back cleanly for missing entries', () => {
    const runtime = createPlayerDetailsComparisonRuntime({
      cleanValue,
      filterDistributionCache: new Map([
        [
          'STC',
          {
            Fin: { max: 18, min: 8 }
          }
        ]
      ]),
      minMins: null
    });

    expect(getFilterDistribution(runtime, 'STC', 'Fin')).toEqual({ max: 18, min: 8 });
    expect(getFilterDistribution(runtime, 'GK', 'Fin')).toBeNull();
  });

  it('returns the configured role filter range when one exists', () => {
    expect(getFilterLimitRange('STC', 'NP-xG/90')).toEqual({ max: null, min: 0.19 });
    expect(getFilterLimitRange('STC', 'definitely-missing-filter')).toEqual({
      max: null,
      min: null
    });
  });
});
