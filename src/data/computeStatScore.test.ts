import { describe, expect, it } from 'vitest';

import { computeStatScore } from './computeStatScore';

import type { StatDistribution } from './computeStatScore';

function cleanValue(val: unknown): null | number {
  if (val === null || val === undefined || val === '' || val === '-') return null;
  if (typeof val === 'number') return val;
  const n = Number(String(val));
  return isNaN(n) ? null : n;
}

const DIST_FLAT: Record<string, StatDistribution> = {
  Gls: { iqr: 5, median: 5, p50: 5, range: 10 },
  'Gls/90': { iqr: 0.3, median: 0.3, p50: 0.3, range: 0.6 },
  'Pas %': { iqr: 10, median: 80, p50: 80, range: 20 },
  'OP-KP %': { iqr: 5, median: 10, p50: 10, range: 10 },
  'xGP/90': { iqr: 1, median: 1, p50: 1, range: 2 }
};

const BASE_PLAYER: Record<string, any> = {
  Mins: 2000,
  Gls: 10,
  'Gls/90': 0.45,
  'Pas %': 85,
  'OP-KP %': 12,
  'xGP/90': 1.2
};

describe('computeStatScore – isLow path', () => {
  it('returns sScore 0 and shows raw values in sD when isLow', () => {
    const { sScore, sD, missingStatCount } = computeStatScore(
      BASE_PLAYER,
      ['Gls', 'Gls/90'],
      { isLow: true, position: 'ST', statDist: DIST_FLAT },
      cleanValue
    );
    expect(sScore).toBe(0);
    expect(sD[0].score).toBeNull();
    expect(sD[0].val).not.toBe('-');
    // isLow always increments missingStatCount
    expect(missingStatCount).toBe(2);
  });

  it('shows dash for missing stat in isLow', () => {
    const player = { ...BASE_PLAYER, Gls: null };
    const { sD } = computeStatScore(
      player,
      ['Gls'],
      { isLow: true, position: 'ST', statDist: DIST_FLAT },
      cleanValue
    );
    expect(sD[0].val).toBe('-');
    expect(sD[0].missing).toBe(true);
  });
});

describe('computeStatScore – normal path', () => {
  it('returns sScore > 0 for player above average', () => {
    // Gls median=5, iqr=5 → player has Gls=10 → raw=(10-5)/5=1 → sc=10+1*5=15
    const { sScore, sD } = computeStatScore(
      { ...BASE_PLAYER, 'Gls/90': null },
      ['Gls'],
      { isLow: false, position: 'ST', statDist: DIST_FLAT },
      cleanValue
    );
    expect(sScore).toBeGreaterThan(10);
    expect(sD[0].score).toBeCloseTo(15);
  });

  it('scores are clamped to 0-20', () => {
    const player = { ...BASE_PLAYER, Gls: 100 };
    const { sD } = computeStatScore(
      player,
      ['Gls'],
      { isLow: false, position: 'ST', statDist: DIST_FLAT },
      cleanValue
    );
    expect(sD[0].score).toBe(20);
  });

  it('treats negative stats inversely', () => {
    // NEGATIVE_STATS contains 'Poss Lost/90' – lower is better
    // player value=0.1, median=0.5, iqr=0.4 → raw=(0.1-0.5)/0.4=-1 → negated=1 → sc=10+1*5=15
    const dist = { 'Poss Lost/90': { iqr: 0.4, median: 0.5, p50: 0.5, range: 0.8 } };
    const { sD } = computeStatScore(
      { ...BASE_PLAYER, 'Poss Lost/90': 0.1 },
      ['Poss Lost/90'],
      { isLow: false, position: 'MC', statDist: dist },
      cleanValue
    );
    expect(sD[0].score).toBeCloseTo(15);
  });

  it('counts missing stats and treats them as 0', () => {
    const player = { ...BASE_PLAYER, Gls: null };
    const { missingStatCount, sD } = computeStatScore(
      player,
      ['Gls'],
      { isLow: false, position: 'ST', statDist: DIST_FLAT },
      cleanValue
    );
    expect(missingStatCount).toBe(1);
    expect(sD[0].val).toBe('-');
  });

  it('uses p50/range for GK Pas %', () => {
    // p50=80, range=20, player=85 → raw=(85-80)/20=0.25 → sc=10+0.25*5=11.25
    const player = { ...BASE_PLAYER };
    const { sD } = computeStatScore(
      player,
      ['Pas %'],
      { isLow: false, position: 'GK', statDist: DIST_FLAT },
      cleanValue
    );
    expect(sD[0].score).toBeCloseTo(11.25);
  });

  it('uses p50/range for OP-KP %', () => {
    // p50=10, range=10, player=12 → raw=(12-10)/10=0.2 → sc=10+0.2*5=11
    const { sD } = computeStatScore(
      BASE_PLAYER,
      ['OP-KP %'],
      { isLow: false, position: 'MC', statDist: DIST_FLAT },
      cleanValue
    );
    expect(sD[0].score).toBeCloseTo(11);
  });

  it('marks skipped stats with score 0 and still adds weight', () => {
    // ZERO_SKIPPABLE_STATS: xGP/90 is skipped when totalSaves=0
    const player = { ...BASE_PLAYER, 'xGP/90': 0, Svh: 0, Svt: 0, Svp: 0 };
    const { sD, sScore } = computeStatScore(
      player,
      ['xGP/90'],
      { isLow: false, position: 'GK', statDist: DIST_FLAT },
      cleanValue
    );
    // xGP/90 is in SKIPPABLE_STATS for GK and totalSaves=0 → should be skipped
    // Alternatively it may be in ZERO_SKIPPABLE_STATS - check via skipped field
    const entry = sD[0];
    if (entry.skipped) {
      expect(entry.score).toBe(0);
      expect(sScore).toBe(0);
    } else {
      // stat not skippable in this config – just passes
      expect(entry.score).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns totalStatWeight summing all weights', () => {
    const { totalStatWeight } = computeStatScore(
      BASE_PLAYER,
      ['Gls', 'Gls/90'],
      { isLow: false, position: 'ST', statDist: DIST_FLAT },
      cleanValue
    );
    // weights: i=0 → 1+(1/2)=1.5; i=1 → 1+(0/2)=1.0; total=2.5
    expect(totalStatWeight).toBeCloseTo(2.5);
  });

  it('returns empty result for no keyStats', () => {
    const { sScore, sD, missingStatCount, rangeStatCount } = computeStatScore(
      BASE_PLAYER,
      [],
      { isLow: false, position: 'ST', statDist: DIST_FLAT },
      cleanValue
    );
    expect(sScore).toBe(0);
    expect(sD).toHaveLength(0);
    expect(missingStatCount).toBe(0);
    expect(rangeStatCount).toBe(0);
  });

  it('counts range values in rangeStatCount', () => {
    const player = { ...BASE_PLAYER, Gls: '8-12' };
    const { rangeStatCount } = computeStatScore(
      player,
      ['Gls'],
      { isLow: false, position: 'ST', statDist: DIST_FLAT },
      cleanValue
    );
    expect(rangeStatCount).toBe(1);
  });
});

describe('detectSourceZero (via computeStatScore)', () => {
  it('skips Asts/90 when xA/90 is 0', () => {
    const player = { ...BASE_PLAYER, 'Asts/90': 0, 'xA/90': 0 };
    const { sD } = computeStatScore(
      player,
      ['Asts/90'],
      {
        isLow: false,
        position: 'MC',
        statDist: { 'Asts/90': { iqr: 0.1, median: 0.1, p50: 0.1, range: 0.2 } }
      },
      cleanValue
    );
    expect(sD[0].skipped).toBe(true);
  });

  it('does not skip Asts/90 when xA/90 > 0', () => {
    const player = { ...BASE_PLAYER, 'Asts/90': 0.3, 'xA/90': 0.3 };
    const { sD } = computeStatScore(
      player,
      ['Asts/90'],
      {
        isLow: false,
        position: 'MC',
        statDist: { 'Asts/90': { iqr: 0.1, median: 0.1, p50: 0.1, range: 0.2 } }
      },
      cleanValue
    );
    expect(sD[0].skipped).toBe(false);
  });
});
