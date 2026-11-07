import { describe, expect, it } from 'vitest';

import { POSITION_FILTERS, STATS_CONFIG } from '../config/scoreConfig';
import { parseNumber } from '../data/parseNumber';

import {
  adjustLdcStatValue,
  formatAdjustedStat,
  INVERSE_ADJUSTMENT_MAX_FACTOR,
  LDC_VOLUME_STATS
} from './ldcStatApplication';

describe('LDC_VOLUME_STATS coverage', () => {
  it('never re-adds a confirmed-dead entry (no player field is ever written under that name)', () => {
    // 'Assists' (real field is 'Ast'/'Asts per90'), 'xG/90' (never derived,
    // only NP-xG/90 exists), 'Ps A/90' and 'Ps C/90' (typos for the real
    // 'Pas A/90'/'Pas C/90') were verified dead: no code path in src ever
    // writes player[key] for these exact strings.
    const confirmedDead = ['Assists', 'xG/90', 'Ps A/90', 'Ps C/90'];
    const ldcSet = new Set<string>(LDC_VOLUME_STATS);

    for (const dead of confirmedDead) {
      expect(ldcSet.has(dead)).toBe(false);
    }
  });

  it('flags filter-threshold or key stats that are missing from the LDC allowlist', () => {
    // Percentage/ratio/quality stats are intentionally excluded from LDC:
    // adjusting a ratio of two LDC-adjusted quantities would double-count or
    // cancel the multiplier out, so this is an explicit exemption list, not a
    // heuristic - anything not listed here is expected to be a volume stat.
    const RATIO_OR_PERCENTAGE_STATS = new Set([
      'CCC %',
      'Conv %',
      'Duels Win %',
      'Gls In Box %',
      'Hdr %',
      'In Box Conv %',
      'NP-xG/Shot',
      'OP-Cr %',
      'OP-Crs C %',
      'OP-KP %',
      'Pas %',
      'Pen/R',
      'Pres C %',
      'Pr Pass Yield %',
      'Save Efficiency',
      'Saves Held/Shots Faced Ratio',
      'Saves Parried/Shots Faced Ratio',
      'Saves Tipped/Shots Faced Ratio',
      'ShT %',
      'Shts In %',
      'Sv %',
      'Tck Qual',
      'Tck R',
      'Tck W %'
    ]);

    const liveVolumeKeys = new Set<string>();
    for (const keyStats of Object.values(STATS_CONFIG)) {
      for (const key of keyStats) {
        if (!RATIO_OR_PERCENTAGE_STATS.has(key)) liveVolumeKeys.add(key);
      }
    }
    for (const thresholds of Object.values(POSITION_FILTERS)) {
      for (const key of Object.keys(thresholds)) {
        if (!RATIO_OR_PERCENTAGE_STATS.has(key)) liveVolumeKeys.add(key);
      }
    }

    const ldcSet = new Set<string>(LDC_VOLUME_STATS);
    const missing = [...liveVolumeKeys]
      .filter((key) => !ldcSet.has(key))
      .toSorted((a, b) => a.localeCompare(b));

    expect(missing).toEqual([]);
  });

  it('applies inverse adjustment to the newly-added lower-is-better filter stats', () => {
    expect(adjustLdcStatValue('Fls Made/90', 4, 0.5)).toBe(8);
    expect(adjustLdcStatValue('Tck Failed/90', 4, 0.5)).toBe(8);
  });

  it('applies direct multiplication to the newly-added higher-is-better filter stats', () => {
    // Clr/90, Svp/90 and Svt/90 carry a POSITION_FILTERS `max` eligibility
    // ceiling for GK, but that gates save-style/workload, not whether more
    // of the stat is a good outcome - they are deliberately absent from
    // NEGATIVE_STATS, so LDC must scale them like any other accomplishment.
    for (const stat of [
      'Blk/90',
      'Ch C/90',
      'Clr/90',
      'Hdrs A/90',
      'K Ps/90',
      'Pas C/90',
      'Saves/90',
      'Svh/90',
      'Svp/90',
      'Svt/90'
    ]) {
      expect(adjustLdcStatValue(stat, 10, 0.5)).toBe(5);
    }
  });
});

describe('adjustLdcStatValue', () => {
  it('caps inverse adjustment factor for lower-is-better stats', () => {
    // Multiplier 1e-8 would otherwise inflate the value by 1e8.
    expect(adjustLdcStatValue('Poss Lost/90', 5, 0.00000001)).toBe(
      5 * INVERSE_ADJUSTMENT_MAX_FACTOR
    );
  });

  it('divides normally when multiplier is above the cap threshold', () => {
    expect(adjustLdcStatValue('Poss Lost/90', 5, 0.5)).toBe(10);
  });

  it('caps inverse adjustment for negative signed higher-is-better values', () => {
    expect(adjustLdcStatValue('Poss+/-/90', -2, 0.00000001)).toBe(
      -2 * INVERSE_ADJUSTMENT_MAX_FACTOR
    );
  });

  it('multiplies positive higher-is-better values without a cap', () => {
    expect(adjustLdcStatValue('Gls/90', 0.5, 0.00000001)).toBeCloseTo(0.000000005, 12);
  });
});

describe('formatAdjustedStat', () => {
  it('keeps significant digits for small magnitudes instead of collapsing to 0.00', () => {
    expect(formatAdjustedStat(0.0005)).toBe('0.000500000');
    expect(formatAdjustedStat(-0.004)).toBe('-0.00400000');
  });

  it('preserves distinct sub-1e-4 values (no fixed-decimal truncation)', () => {
    const a = formatAdjustedStat(5e-9);
    const b = formatAdjustedStat(4.9e-9);
    expect(parseFloat(a)).toBeCloseTo(5e-9, 12);
    expect(a).not.toBe(b);
  });

  it('never emits scientific notation and round-trips through the real number parser', () => {
    for (const value of [5e-9, 4.9e-9, 1.23e-7, 0.0005, -0.004, 0.0099]) {
      const formatted = formatAdjustedStat(value);
      expect(formatted).not.toMatch(/e/i);
      // parseNumber strips letters, so scientific notation would be read as
      // the mantissa alone (5e-9 -> 5). Guard the actual scoring path.
      expect(parseNumber(formatted)).toBeCloseTo(value, 12);
    }
  });

  it('uses 2 decimals for normal magnitudes and zero', () => {
    expect(formatAdjustedStat(0.5)).toBe('0.50');
    expect(formatAdjustedStat(0)).toBe('0.00');
    expect(formatAdjustedStat(12.345)).toBe('12.35');
  });
});
