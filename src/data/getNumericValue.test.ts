import { describe, expect, it } from 'vitest';

import { getNumericValue } from './getNumericValue';

describe('getNumericValue', () => {
  // ── null / undefined ──────────────────────────────────────────────────────

  it('returns null for null', () => {
    expect(getNumericValue(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getNumericValue(undefined)).toBeNull();
  });

  // ── number passthrough ────────────────────────────────────────────────────

  it('passes positive numbers through unchanged', () => {
    expect(getNumericValue(15)).toBe(15);
    expect(getNumericValue(0)).toBe(0);
    expect(getNumericValue(3.5)).toBe(3.5);
  });

  it('clamps negative number to 0 (val<0 always clamped)', () => {
    expect(getNumericValue(-5)).toBe(0);
  });

  it('clamps negative number to 0 when isWage=true', () => {
    expect(getNumericValue(-5, false, true)).toBe(0);
  });

  // ── missing symbols ───────────────────────────────────────────────────────

  it('returns null for dash', () => {
    expect(getNumericValue('-')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getNumericValue('')).toBeNull();
  });

  it('returns null for known missing symbols', () => {
    for (const sym of [
      'N/A',
      'N/D',
      'n/d',
      'brak',
      'none',
      'N/d',
      'Nieznane',
      'Nieznany',
      'Nieznana',
      'Unknown'
    ]) {
      expect(getNumericValue(sym), sym).toBeNull();
    }
  });

  it('returns 0 for missing symbols when isWage=true', () => {
    expect(getNumericValue('N/A', false, true)).toBe(0);
    expect(getNumericValue('brak', false, true)).toBe(0);
    expect(getNumericValue('-', false, true)).toBe(0);
  });

  // ── ranges ────────────────────────────────────────────────────────────────

  it('returns null for plain numeric range by default', () => {
    expect(getNumericValue('10-20')).toBeNull();
  });

  it('returns average for range when useAverageForRanges=true', () => {
    expect(getNumericValue('10-20', true)).toBe(15);
  });

  it('handles en-dash ranges', () => {
    expect(getNumericValue('10–20', true)).toBe(15);
  });

  it('handles em-dash ranges', () => {
    expect(getNumericValue('10\u201420', true)).toBe(15);
  });

  it('string starting with dash is not treated as range, parsed negative → clamped to 0', () => {
    expect(getNumericValue('-10-10', true)).toBe(0);
  });

  it('plain negative string is parsed and clamped to 0', () => {
    expect(getNumericValue('-5')).toBe(0);
  });

  // ── plain numbers ─────────────────────────────────────────────────────────

  it('parses integer strings', () => {
    expect(getNumericValue('42')).toBe(42);
    expect(getNumericValue('0')).toBe(0);
  });

  it('clamps parsed result to ≥0', () => {
    expect(getNumericValue('0')).toBe(0);
  });

  it('parses K multiplier', () => {
    expect(getNumericValue('1K')).toBe(1000);
    expect(getNumericValue('2.5K')).toBe(2500);
  });

  it('parses M multiplier', () => {
    expect(getNumericValue('1M')).toBe(1_000_000);
  });

  it('returns null for non-numeric strings', () => {
    expect(getNumericValue('abc')).toBeNull();
    expect(getNumericValue('Manchester City')).toBeNull();
  });
});
