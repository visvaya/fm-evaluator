import { beforeEach, describe, expect, it } from 'vitest';

import { createCleanValue, type CleanValueFn } from './cleanValue';

describe('createCleanValue', () => {
  let cache: Map<string, null | number | string>;
  let cleanValue: CleanValueFn;

  beforeEach(() => {
    cache = new Map();
    cleanValue = createCleanValue(cache);
  });

  // ── null / undefined ──────────────────────────────────────────────────────

  it('returns null for null', () => {
    expect(cleanValue(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    const value: unknown = undefined;
    expect(cleanValue(value)).toBeNull();
  });

  // ── already a number ─────────────────────────────────────────────────────

  it('passes through numbers unchanged', () => {
    expect(cleanValue(14)).toBe(14);
    expect(cleanValue(0)).toBe(0);
    expect(cleanValue(-5)).toBe(-5);
    expect(cleanValue(1.5)).toBe(1.5);
  });

  // ── missing symbols ───────────────────────────────────────────────────────

  it('returns null for dash (non-wage)', () => {
    expect(cleanValue('-')).toBeNull();
  });

  it('returns 0 for dash when isWage=true', () => {
    expect(cleanValue('-', true)).toBe(0);
  });

  it('returns null for empty string', () => {
    expect(cleanValue('')).toBeNull();
  });

  it.each([
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
  ])('returns null for known missing symbol %s', (sym) => {
    expect(cleanValue(sym)).toBeNull();
  });

  it('returns 0 for missing symbols when isWage=true', () => {
    expect(cleanValue('N/A', true)).toBe(0);
    expect(cleanValue('brak', true)).toBe(0);
  });

  // ── foot strength labels ──────────────────────────────────────────────────

  it('maps English foot strength labels', () => {
    expect(cleanValue('Very Strong')).toBe(5);
    expect(cleanValue('Strong')).toBe(4);
    expect(cleanValue('Fairly Strong')).toBe(3);
    expect(cleanValue('Reasonable')).toBe(2);
    expect(cleanValue('Weak')).toBe(1);
    expect(cleanValue('Very Weak')).toBe(0);
  });

  it('maps Polish foot strength labels', () => {
    expect(cleanValue('Bardzo mocna')).toBe(5);
    expect(cleanValue('Mocna')).toBe(4);
    expect(cleanValue('Względnie mocna')).toBe(3);
    expect(cleanValue('Przyzwoita')).toBe(2);
    expect(cleanValue('Słaba')).toBe(1);
    expect(cleanValue('Bardzo słaba')).toBe(0);
  });

  it('caches strength map results', () => {
    cleanValue('Strong');
    expect(cache.has('Strong')).toBe(true);
    expect(cache.get('Strong')).toBe(4);
  });

  // ── numeric ranges without currency ──────────────────────────────────────

  it('returns midpoint for plain numeric range with hyphen', () => {
    expect(cleanValue('10-20')).toBe(15);
  });

  it('returns midpoint for range with en-dash', () => {
    expect(cleanValue('10–20')).toBe(15);
  });

  it('returns midpoint for range with em-dash', () => {
    expect(cleanValue('10\u201420')).toBe(15);
  });

  it('caches numeric range midpoints', () => {
    cleanValue('5-15');
    expect(cache.get('5-15')).toBe(10);
  });

  // ── ranges with currency/units → string passthrough ──────────────────────

  it('passes through currency range as string', () => {
    expect(cleanValue('1K € - 8K €')).toBe('1K € - 8K €');
    expect(cleanValue('14 tys. € – 140 tys. €')).toBe('14 tys. € – 140 tys. €');
    expect(cleanValue('325K € - 700K €')).toBe('325K € - 700K €');
  });

  it('passes through ranges with M/K multiplier as string', () => {
    expect(cleanValue('1M - 2M')).toBe('1M - 2M');
    expect(cleanValue('500K - 1K')).toBe('500K - 1K');
  });

  // ── plain numbers ─────────────────────────────────────────────────────────

  it('parses plain integers', () => {
    expect(cleanValue('42')).toBe(42);
    expect(cleanValue('0')).toBe(0);
  });

  it('parses K/M multipliers', () => {
    expect(cleanValue('1K')).toBe(1000);
    expect(cleanValue('1.5M')).toBe(1_500_000);
  });

  it('parses Polish tys/mln multipliers', () => {
    expect(cleanValue('2tys')).toBe(2000);
    expect(cleanValue('1mln')).toBe(1_000_000);
  });

  it('clamps currency values to ≥0', () => {
    expect(cleanValue('-500€')).toBe(0);
    expect(cleanValue('$-100')).toBe(0);
  });

  it('clamps when isWage=true', () => {
    expect(cleanValue('-1000', true)).toBe(0);
  });

  it('caches parsed numbers', () => {
    cleanValue('99');
    expect(cache.get('99')).toBe(99);
  });

  // ── string fallback ───────────────────────────────────────────────────────

  it('returns string as-is for non-numeric values', () => {
    expect(cleanValue('Manchester City')).toBe('Manchester City');
    expect(cleanValue('Premier League')).toBe('Premier League');
  });

  // ── caching correctness ───────────────────────────────────────────────────

  it('returns cached value on second call', () => {
    cache.set('cached-key', 999);
    expect(cleanValue('cached-key')).toBe(999);
  });

  it('cache cleared externally takes effect immediately', () => {
    cleanValue('77');
    expect(cache.get('77')).toBe(77);
    cache.clear();
    // Next call will recompute – cache should not interfere
    expect(cleanValue('77')).toBe(77);
    expect(cache.get('77')).toBe(77);
  });

  it('two instances with separate caches are independent', () => {
    const cache2 = new Map<string, null | number | string>();
    const cv2 = createCleanValue(cache2);
    cleanValue('10');
    expect(cache2.has('10')).toBe(false);
    cv2('10');
    expect(cache2.get('10')).toBe(10);
  });
});
