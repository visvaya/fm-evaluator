import { describe, expect, it, vi } from 'vitest';

import { clearPlayerRuntimeRows, setPlayerRuntimeRows } from '@/lib/playerRuntimeCache';

import { calculatePercentile, getStatPercentile } from './statPercentiles';

describe('statPercentiles', () => {
  it('uses the runtime rows cache as percentile context', () => {
    setPlayerRuntimeRows([
      { Acc: 10, Position: 'STC', Saves: 1 },
      { Acc: 12, Position: 'STC', Saves: 2 },
      { Acc: 15, Position: 'GK', Saves: 5 },
      { Acc: '-', Position: 'STC', Saves: '-' }
    ]);

    expect(getStatPercentile('Acc', 12, 'STC', true)).toBeCloseTo(66.67, 2);
    clearPlayerRuntimeRows();
  });

  it('calculates percentiles from sorted values', () => {
    expect(calculatePercentile(12, [10, 12, 15])).toBeCloseTo(66.67, 2);
    expect(calculatePercentile(Number.NaN, [10, 12, 15])).toBeNull();
    expect(calculatePercentile(12, [])).toBeNull();
  });

  it('calculates attribute percentiles across all players', () => {
    setPlayerRuntimeRows([
      { Acc: 10, Position: 'STC', Saves: 1 },
      { Acc: 12, Position: 'STC', Saves: 2 },
      { Acc: 15, Position: 'GK', Saves: 5 },
      { Acc: '-', Position: 'STC', Saves: '-' }
    ]);

    expect(getStatPercentile('Acc', 12, 'STC', true)).toBeCloseTo(66.67, 2);
    clearPlayerRuntimeRows();
  });

  it('calculates stat percentiles inside the active position group', () => {
    setPlayerRuntimeRows([
      { Acc: 10, Position: 'STC', Saves: 1 },
      { Acc: 12, Position: 'STC', Saves: 2 },
      { Acc: 15, Position: 'GK', Saves: 5 },
      { Acc: '-', Position: 'STC', Saves: '-' }
    ]);

    expect(getStatPercentile('Saves', 5, 'GK')).toBe(100);
    expect(getStatPercentile('Saves', 2, 'STC')).toBe(100);
    clearPlayerRuntimeRows();
  });
});
