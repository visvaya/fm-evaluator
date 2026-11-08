import { describe, expect, it } from 'vitest';

import { computeAttributeScore } from './computeAttributeScore';
import { splitRange } from './splitRange';

function cleanValue(val: unknown): null | number {
  if (val === null || val === undefined || val === '' || val === '-') return null;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  // Range: average
  const m = splitRange(s);
  if (m && !s.startsWith('-')) {
    const a = Number(m[0]);
    const b = Number(m[1]);
    if (!isNaN(a) && !isNaN(b)) return (a + b) / 2;
  }
  const n = Number(s);
  return isNaN(n) ? null : n;
}

const COEFFS = { Pac: 1, Acc: 1, Str: 0.5 };

describe('computeAttributeScore', () => {
  it('calculates weighted average for all-present attributes', () => {
    const player = { Pac: 15, Acc: 10, Str: 20 };
    const { aScore, missingAttrCount, rangeAttrCount } = computeAttributeScore(
      player,
      COEFFS,
      cleanValue
    );
    // aSum = 15*1 + 10*1 + 20*0.5 = 35; aW = 1+1+0.5 = 2.5; aScore = 35/2.5 = 14
    expect(aScore).toBe(14);
    expect(missingAttrCount).toBe(0);
    expect(rangeAttrCount).toBe(0);
  });

  it('counts missing attributes and treats them as 0 in score', () => {
    const player = { Pac: null, Acc: 10, Str: 20 };
    const { aScore, missingAttrCount } = computeAttributeScore(player, COEFFS, cleanValue);
    // aSum = 0*1 + 10*1 + 20*0.5 = 20; aW = 2.5; aScore = 8
    expect(missingAttrCount).toBe(1);
    expect(aScore).toBe(8);
  });

  it('counts dash as missing', () => {
    const player = { Pac: '-', Acc: 10, Str: 10 };
    const { missingAttrCount } = computeAttributeScore(player, COEFFS, cleanValue);
    expect(missingAttrCount).toBe(1);
  });

  it('counts undefined attribute as missing', () => {
    const player = { Acc: 10, Str: 10 };
    const { missingAttrCount } = computeAttributeScore(player, COEFFS, cleanValue);
    expect(missingAttrCount).toBe(1);
  });

  it('detects range values and counts them', () => {
    const player = { Pac: '10-14', Acc: 12, Str: 8 };
    const { rangeAttrCount, aScore } = computeAttributeScore(player, COEFFS, cleanValue);
    // cleanValue('10-14') returns 12 (average); aSum = 12*1 + 12*1 + 8*0.5 = 28; aW=2.5; aScore=11.2
    expect(rangeAttrCount).toBe(1);
    expect(aScore).toBeCloseTo(11.2);
  });

  it('handles en-dash and em-dash ranges', () => {
    const player = { Pac: '8–12', Acc: 10, Str: '6\u201414' };
    const { rangeAttrCount } = computeAttributeScore(player, COEFFS, cleanValue);
    expect(rangeAttrCount).toBe(2);
  });

  it('does not count negative numbers as ranges', () => {
    const player = { Pac: -5, Acc: 10, Str: 10 };
    const { rangeAttrCount, missingAttrCount } = computeAttributeScore(player, COEFFS, cleanValue);
    expect(rangeAttrCount).toBe(0);
    expect(missingAttrCount).toBe(0);
  });

  it('returns aScore 0 for empty coefficients', () => {
    const player = { Pac: 15, Acc: 10 };
    const { aScore, aD } = computeAttributeScore(player, {}, cleanValue);
    expect(aScore).toBe(0);
    expect(aD).toHaveLength(0);
  });

  it('handles negative weights correctly', () => {
    const coeffs = { Pac: 2, Pen: -1 };
    const player = { Pac: 15, Pen: 10 };
    const { aScore } = computeAttributeScore(player, coeffs, cleanValue);
    // aSum = 15*2 + 10*(-1) = 20; aW = |2|+|-1| = 3; aScore ≈ 6.67
    expect(aScore).toBeCloseTo(6.667);
  });

  it('returns detail entries (aD) with correct shape', () => {
    const player = { Pac: 14, Acc: null, Str: '8-12' };
    const { aD } = computeAttributeScore(player, COEFFS, cleanValue);
    expect(aD).toHaveLength(3);

    const pac = aD.find((d) => d.name === 'Pac');
    expect(pac?.isMissing).toBe(false);
    expect(pac?.isRange).toBe(false);
    expect(pac?.val).toBe(14);

    const acc = aD.find((d) => d.name === 'Acc');
    expect(acc?.isMissing).toBe(true);

    const str = aD.find((d) => d.name === 'Str');
    expect(str?.isRange).toBe(true);
  });

  it('detail score field equals val * weight', () => {
    const player = { Pac: 10, Acc: 15, Str: 8 };
    const { aD } = computeAttributeScore(player, COEFFS, cleanValue);
    for (const d of aD) {
      expect(d.score).toBeCloseTo(d.val * d.weight);
    }
  });
});
