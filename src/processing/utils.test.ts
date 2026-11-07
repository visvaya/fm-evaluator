import { describe, expect, it } from 'vitest';

import { cleanValue, parseNumber } from './utils';

describe('parseNumber', () => {
  // Null/empty handling
  it('should return null for null', () => {
    expect(parseNumber(null)).toBeNull();
  });
  it('should return null for undefined', () => {
    expect(parseNumber(undefined)).toBeNull();
  });
  it('should return null for empty string', () => {
    expect(parseNumber('')).toBeNull();
  });
  it('should return null for dash', () => {
    expect(parseNumber('-')).toBeNull();
  });
  it('should return null for whitespace-only', () => {
    expect(parseNumber('   ')).toBeNull();
  });

  // Simple numbers
  it('should parse integer', () => {
    expect(parseNumber('42')).toBe(42);
  });
  it('should parse decimal with dot', () => {
    expect(parseNumber('4.5')).toBe(4.5);
  });
  it('should parse negative number', () => {
    expect(parseNumber('-7')).toBe(-7);
  });
  it('should parse number passed as number type', () => {
    expect(parseNumber(100)).toBe(100);
  });

  // K/M suffixes
  it('should parse K suffix (thousands)', () => {
    expect(parseNumber('5K')).toBe(5000);
  });
  it('should parse lowercase k suffix', () => {
    expect(parseNumber('2.5k')).toBe(2500);
  });
  it('should parse M suffix (millions)', () => {
    expect(parseNumber('1.5M')).toBe(1500000);
  });
  it('should parse mln suffix as millions', () => {
    expect(parseNumber('3 mln')).toBe(3000000);
  });

  // Currency handling
  it('should strip euro sign', () => {
    expect(parseNumber('€500')).toBe(500);
  });
  it('should strip p/a suffix', () => {
    expect(parseNumber('120K p/a')).toBe(120000);
  });
  it('should strip p/w suffix', () => {
    expect(parseNumber('5K p/w')).toBe(5000);
  });

  // Length units
  it('should strip km', () => {
    expect(parseNumber('10 km')).toBe(10);
  });
  it('should strip cm', () => {
    expect(parseNumber('185 cm')).toBe(185);
  });
  it('should strip mm', () => {
    expect(parseNumber('50 mm')).toBe(50);
  });
  it('should not treat km as K multiplier', () => {
    // 'km' should be stripped as a unit, not treated as K
    expect(parseNumber('10 km')).toBe(10);
  });

  // Locale separators
  it('should parse comma as thousands (e.g. "17,750")', () => {
    expect(parseNumber('17,750')).toBe(17750);
  });
  it('should parse comma as decimal for short fraction (e.g. "12,45")', () => {
    expect(parseNumber('12,45')).toBe(12.45);
  });
  it('should parse dot-comma format (e.g. "1.234,56")', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56);
  });
  it('should parse comma-dot format (e.g. "1,234.56")', () => {
    expect(parseNumber('1,234.56')).toBe(1234.56);
  });

  // Non-parseable
  it('should return null for non-numeric string', () => {
    expect(parseNumber('abc')).toBeNull();
  });
  it('should return null for just currency sign', () => {
    expect(parseNumber('€')).toBeNull();
  });
});

describe('cleanValue', () => {
  // Null/undefined
  it('should return null for null', () => {
    expect(cleanValue(null)).toBeNull();
  });
  it('should return null for undefined', () => {
    expect(cleanValue(undefined)).toBeNull();
  });

  // Numbers pass through
  it('should return number as-is', () => {
    expect(cleanValue(42)).toBe(42);
  });
  it('should return 0 as-is', () => {
    expect(cleanValue(0)).toBe(0);
  });

  // Dash/empty handling
  it('should return null for dash (non-wage)', () => {
    expect(cleanValue('-')).toBeNull();
  });
  it('should return 0 for dash (wage)', () => {
    expect(cleanValue('-', true)).toBe(0);
  });
  it('should return null for empty string (non-wage)', () => {
    expect(cleanValue('')).toBeNull();
  });
  it('should return 0 for empty string (wage)', () => {
    expect(cleanValue('', true)).toBe(0);
  });
  it('should return null for N/A (non-wage)', () => {
    expect(cleanValue('N/A')).toBeNull();
  });
  it('should return 0 for N/A (wage)', () => {
    expect(cleanValue('N/A', true)).toBe(0);
  });

  // Parseable numbers
  it('should parse simple number string', () => {
    expect(cleanValue('42')).toBe(42);
  });
  it('should parse K suffix', () => {
    expect(cleanValue('5K')).toBe(5000);
  });

  // Ranges with currency – keep as string
  it('should keep range with currency as string', () => {
    expect(cleanValue('1K € - 6K €')).toBe('1K € - 6K €');
  });
  it('should keep range with p/w as string', () => {
    expect(cleanValue('5K p/w - 10K p/w')).toBe('5K p/w - 10K p/w');
  });

  // Simple numeric ranges – return average
  it('should return average for simple numeric range', () => {
    expect(cleanValue('12-15')).toBe(13.5);
  });
  it('should return average for decimal range', () => {
    expect(cleanValue('1.5-2.5')).toBe(2);
  });

  // Non-parseable string returned as-is
  it('should return non-parseable string as-is', () => {
    expect(cleanValue('Some Text')).toBe('Some Text');
  });
});
