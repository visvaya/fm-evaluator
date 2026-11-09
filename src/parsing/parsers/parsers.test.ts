// @vitest-environment jsdom
/**
 * Tests for all 6 specialized parsers + UniversalParser router
 *
 * The six value parsers and UniversalParser are imported directly.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { UniversalParser } from '../universalParser.js';

import { AttributeParser } from './attributeParser.js';
import { CurrencyParser } from './currencyParser.js';
import { DateParser } from './dateParser.js';
import { DistanceParser } from './distanceParser.js';
import { StatisticParser } from './statisticParser.js';
import { WageParser } from './wageParser.js';

// ============================================================================
// AttributeParser
// ============================================================================

describe('AttributeParser', () => {
  let parser: any;
  beforeAll(() => {
    parser = new AttributeParser();
  });

  it('should parse single integer', () => {
    expect(parser.parse('14')).toBe(14);
    expect(parser.parse('1')).toBe(1);
    expect(parser.parse('20')).toBe(20);
  });

  it('should clamp to 1-20', () => {
    expect(parser.parse('0')).toBe(1);
    expect(parser.parse('25')).toBe(20);
    expect(parser.parse('-3')).toBe(1);
  });

  it('should parse ranges and average them', () => {
    expect(parser.parse('7-14')).toBe(11); // (7+14)/2 = 10.5 → 11
    expect(parser.parse('1-20')).toBe(11); // (1+20)/2 = 10.5 → 11
    expect(parser.parse('10-10')).toBe(10);
  });

  it('should return null for empty / null / dash / N/A', () => {
    expect(parser.parse('')).toBeNull();
    expect(parser.parse(null)).toBeNull();
    expect(parser.parse()).toBeNull();
    expect(parser.parse('-')).toBeNull();
    expect(parser.parse('N/A')).toBeNull();
  });

  it('should return null for non-numeric strings', () => {
    expect(parser.parse('abc')).toBeNull();
    expect(parser.parse('Bardzo mocna')).toBeNull();
  });

  it('should trim whitespace', () => {
    expect(parser.parse('  12  ')).toBe(12);
  });
});

// ============================================================================
// CurrencyParser
// ============================================================================

describe('CurrencyParser', () => {
  let parser: any;
  beforeAll(() => {
    parser = new CurrencyParser();
  });

  it('should parse plain number', () => {
    expect(parser.parseCurrency('1000')).toBe(1000);
  });

  it('should handle K/M multipliers from languageConfig', () => {
    const langConfig = { multipliers: { K: 1000, M: 1000000 } };
    expect(parser.parseCurrency('1.2M', {}, langConfig)).toBe(1200000);
    expect(parser.parseCurrency('850K', {}, langConfig)).toBe(850000);
  });

  it('should remove currency symbols (€, $, £, ¥, zł)', () => {
    expect(parser.parseCurrency('€1000')).toBe(1000);
    expect(parser.parseCurrency('$500')).toBe(500);
    expect(parser.parseCurrency('£250')).toBe(250);
  });

  it('should handle negative via parentheses', () => {
    expect(parser.parseCurrency('(€500)')).toBe(-500);
  });

  it('should handle negative via leading minus', () => {
    expect(parser.parseCurrency('-€500')).toBe(-500);
  });

  it('should handle negative via trailing minus', () => {
    expect(parser.parseCurrency('€500-')).toBe(-500);
  });

  it('should handle negative via minus after symbol', () => {
    expect(parser.parseCurrency('€-500')).toBe(-500);
  });

  it('should handle comma decimal separator (Polish style)', () => {
    const fmt = { decimalSeparator: ',' };
    expect(parser.parseCurrency('1,2', fmt, { multipliers: { M: 1000000 } })).toBe(1.2);
  });

  it('should return null for empty / null / dash / N/A', () => {
    expect(parser.parseCurrency('')).toBeNull();
    expect(parser.parseCurrency(null)).toBeNull();
    expect(parser.parseCurrency('-')).toBeNull();
    expect(parser.parseCurrency('N/A')).toBeNull();
  });

  it('should remove NBSP (non-breaking space)', () => {
    expect(parser.parseCurrency('1\u00A0000')).toBe(1000);
  });

  it('keeps the multiplier when the zloty sign follows the amount', () => {
    const fmt = { decimalSeparator: ',' };
    const lang = { multipliers: { K: 1000, M: 1000000 } };
    const currencyParser = new CurrencyParser();
    expect(currencyParser.parseCurrency('1,5M z\u0142', fmt, lang)).toBe(1500000);
    expect(currencyParser.parseCurrency('250K z\u0142', fmt, lang)).toBe(250000);
  });

  it('keeps the decimal comma when the dot groups thousands', () => {
    const fmt = { decimalSeparator: ',', thousandSeparator: '.' };
    const lang = { multipliers: { M: 1000000 } };
    const currencyParser = new CurrencyParser();
    expect(currencyParser.parseCurrency('1,5M \u20AC', fmt, lang)).toBe(1500000);
    expect(currencyParser.parseCurrency('1.234,5 \u20AC', fmt, lang)).toBe(1234.5);
  });
});

// Money cells of real exports, read with the shipped language configs. Every export used a dot
// for decimals and a comma for thousands.
const LANGUAGES_DIR = path.join(
  fileURLToPath(import.meta.url),
  '..',
  '..',
  '..',
  '..',
  'public',
  'config',
  'languages'
);
const EXPORT_FORMAT = { decimalSeparator: '.', thousandSeparator: ',' };
const languageConfig = (id: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(LANGUAGES_DIR, `${id}.json`), 'utf8')) as Record<
    string,
    unknown
  >;
const parse = (id: string, cell: string): unknown =>
  new CurrencyParser().parseCurrency(cell, EXPORT_FORMAT, languageConfig(id));
const wage = (id: string, cell: string): unknown =>
  new WageParser().parse(cell, EXPORT_FORMAT, null, languageConfig(id));

describe('CurrencyParser with the language configs', () => {
  it.each([
    ['en', '1.5K \u20AC', 1500],
    ['da', '1.6K \u20AC', 1600],
    ['el', '1.5\u03C7. \u20AC', 1500],
    ['es', '1.6m \u20AC', 1600],
    ['it', '1.5m \u20AC', 1500],
    ['ja', '1.5\u5343 \u20AC', 1500],
    ['ko', '1.4\uB9CC \u20AC', 14_000],
    ['no', '1,600 \u20AC', 1600],
    ['pl', '1.6 tys. \u20AC', 1600],
    ['pt', '1.6m \u20AC', 1600],
    ['ru', '1.5\u0442\u044B\u0441. \u20AC', 1500],
    ['sv', '1.6t \u20AC', 1600],
    ['tr', '1.5B \u20AC', 1500],
    ['zh', '1.4\u4E07 \u20AC', 14_000]
  ])('reads the %s thousands unit in %s', (id, cell, value) => {
    expect(parse(id, cell)).toBe(value);
  });

  it.each([
    ['en', '9K \u20AC - 35K \u20AC', 22_000],
    ['en', '500 \u20AC - 6K \u20AC', 3250],
    ['fr', '14K \u20AC - 140K \u20AC', 77_000],
    ['ja', '9\u5343 \u20AC - 3.5\u4E07 \u20AC', 22_000],
    ['ko', '0 \u20AC - 7\uB9CC \u20AC', 35_000],
    ['ko', '1500 \u20AC - 4500 \u20AC', 3000],
    ['no', '14,000 \u20AC - 140,000 \u20AC', 77_000],
    ['pl', '14 tys. \u20AC - 140 tys. \u20AC', 77_000],
    ['tr', '14B \u20AC - 140B \u20AC', 77_000]
  ])('reads a %s range %s as its midpoint', (id, cell, value) => {
    expect(parse(id, cell)).toBe(value);
  });

  it('reads a range whose dash sits between non-breaking spaces', () => {
    const nbsp = String.fromCodePoint(0xa0);
    expect(parse('en', `9K${nbsp}€${nbsp}-${nbsp}35K${nbsp}€`)).toBe(22_000);
  });

  it('keeps a minus after the currency sign negative', () => {
    expect(parse('en', '\u20AC -500')).toBe(-500);
  });

  it.each([
    ['en', '1,700 \u20AC p/a', 1700],
    ['ko', '\uC5F0\uBD09 1.3\uB9CC \u20AC', 13_000],
    ['tr', '1,700 \u20AC y\u0131ll\u0131k', 1700],
    ['zh', '1.3\u4E07 \u20AC/\u5E74', 13_000]
  ])('reads the %s yearly wage %s', (id, cell, value) => {
    expect(wage(id, cell)).toBe(value);
  });
});

// ============================================================================
// StatisticParser
// ============================================================================

describe('StatisticParser', () => {
  let parser: any;
  beforeAll(() => {
    parser = new StatisticParser();
  });

  it('should parse integer', () => {
    expect(parser.parse('42')).toBe(42);
  });

  it('should parse float', () => {
    expect(parser.parse('7.18')).toBe(7.18);
  });

  it('should handle comma decimal (Polish)', () => {
    expect(parser.parse('7,18', { decimalSeparator: ',' })).toBe(7.18);
  });

  it('should handle negative with leading minus', () => {
    expect(parser.parse('-3.5')).toBe(-3.5);
  });

  it('should handle negative with parentheses', () => {
    expect(parser.parse('(5)')).toBe(-5);
  });

  it('should remove thousand separators', () => {
    expect(parser.parse('2,580', { thousandSeparator: ',' })).toBe(2580);
  });

  it('should remove a dot thousand separator literally', () => {
    expect(new StatisticParser().parse('1.234.567', { thousandSeparator: '.' })).toBe(1234567);
  });

  it('should remove NBSP', () => {
    expect(parser.parse('2\u00A0580')).toBe(2580);
  });

  it('should return null for empty / null / dash / N/A', () => {
    expect(parser.parse('')).toBeNull();
    expect(parser.parse(null)).toBeNull();
    expect(parser.parse('-')).toBeNull();
    expect(parser.parse('N/A')).toBeNull();
  });
});

// ============================================================================
// DateParser
// ============================================================================

describe('DateParser', () => {
  let parser: any;
  beforeAll(() => {
    parser = new DateParser();
  });

  it('should parse DD.MM.YYYY format to an ISO string', () => {
    const result = parser.parse('12.3.1997', { dateFormat: { format: 'DD/MM', separator: '.' } });
    expect(result).toBe('1997-03-12');
  });

  it('should parse MM/DD/YYYY format', () => {
    const result = parser.parse('3/12/1997', { dateFormat: { format: 'MM/DD', separator: '/' } });
    expect(result).toBe('1997-03-12');
  });

  it('should parse YYYY-MM-DD format', () => {
    const result = parser.parse('1997-03-12', {
      dateFormat: { format: 'YYYY-MM-DD', separator: '-' }
    });
    expect(result).toBe('1997-03-12');
  });

  it('should accept any of the separators . / - regardless of the detected one', () => {
    const ctx = { dateFormat: { format: 'DD/MM', separator: '/' } };
    expect(parser.parse('30.6.2025', ctx)).toBe('2025-06-30');
    expect(parser.parse('30-6-2025', ctx)).toBe('2025-06-30');
    expect(parser.parse('30/6/2025', ctx)).toBe('2025-06-30');
  });

  it('should strip a trailing parenthesised age suffix', () => {
    const ctx = { dateFormat: { format: 'DD/MM', separator: '.' } };
    expect(parser.parse('16.9.1992 (31 years old)', ctx)).toBe('1992-09-16');
    expect(parser.parse('25.1.2006 (18 l.)', ctx)).toBe('2006-01-25');
  });

  it('should handle 2-digit years (< 50 -> 2000s, >= 50 -> 1900s)', () => {
    const result1 = parser.parse('1.1.25', { dateFormat: { format: 'DD/MM', separator: '.' } });
    expect(result1).toBe('2025-01-01');

    const result2 = parser.parse('1.1.97', { dateFormat: { format: 'DD/MM', separator: '.' } });
    expect(result2).toBe('1997-01-01');
  });

  it('should default to DD/MM when no format context is given', () => {
    expect(parser.parse('25/3/1997')).toBe('1997-03-25');
  });

  it('should auto-detect when format is ambiguous', () => {
    const ctx = { dateFormat: { format: 'AMBIGUOUS', separator: '/' } };
    // 25 > 12 in the first slot: DD/MM; in the second slot: MM/DD
    expect(parser.parse('25/3/1997', ctx)).toBe('1997-03-25');
    expect(parser.parse('3/25/1997', ctx)).toBe('1997-03-25');
    expect(parser.parse('16.9.1992 (31 years old)', ctx)).toBe('1992-09-16');
    expect(parser.parse('31/2/2000', ctx)).toBeNull();
  });

  it('should return null for empty / null / dash / N/A', () => {
    expect(parser.parse('')).toBeNull();
    expect(parser.parse(null)).toBeNull();
    expect(parser.parse('-')).toBeNull();
    expect(parser.parse('N/A')).toBeNull();
  });

  it('should return null for invalid date (Feb 30)', () => {
    const result = parser.parse('30.2.2000', { dateFormat: { format: 'DD/MM', separator: '.' } });
    expect(result).toBeNull();
  });

  it('should return null for too few parts', () => {
    const result = parser.parse('12.3', { dateFormat: { format: 'DD/MM', separator: '.' } });
    expect(result).toBeNull();
  });
});

// ============================================================================
// DistanceParser
// ============================================================================

describe('DistanceParser', () => {
  let parser: any;
  beforeAll(() => {
    parser = new DistanceParser();
  });

  it('should parse km suffix', () => {
    expect(parser.parse('342.5km')).toBe(342.5);
  });

  it('should parse with comma decimal (Polish)', () => {
    expect(parser.parse('342,5km', { decimalSeparator: ',' })).toBe(342.5);
  });

  it('should normalize with multiplier when config provided', () => {
    const normConfig = {
      getDistanceMultiplier: (unit: string) => (unit === 'mi' ? 1.60934 : 1)
    };
    // Note: unit detection uses \b word boundary – needs space before unit
    const result = parser.parse('100 mi', {}, normConfig);
    expect(result).toBeCloseTo(160.934, 2);
  });

  it('should detect units with word boundary (space before unit)', () => {
    // _detectUnit uses \b regex – units are recognized when separated from digits
    expect(parser.parse('10 km')).toBe(10);
    expect(parser.parse('5000 m')).toBe(5000);
    expect(parser.parse('3 mi')).toBe(3);
    expect(parser.parse('100 yd')).toBe(100);
  });

  it('should extract number even when unit is attached (no normalization)', () => {
    // "342.5km" – _detectUnit has \b regex so unit won't match at digit boundary
    // but the number is still extracted correctly
    expect(parser.parse('342.5km')).toBe(342.5);
  });

  it('should return null for empty / null / dash / N/A', () => {
    expect(parser.parse('')).toBeNull();
    expect(parser.parse(null)).toBeNull();
    expect(parser.parse('-')).toBeNull();
    expect(parser.parse('N/A')).toBeNull();
  });
});

// ============================================================================
// WageParser
// ============================================================================

describe('WageParser', () => {
  let parser: any;
  beforeAll(() => {
    parser = new WageParser();
  });

  it('should parse wage as currency value', () => {
    expect(parser.parse('18000')).toBe(18000);
  });

  it('keeps the multiplier when a frequency follows the amount', () => {
    const wageParser = new WageParser();
    const lang = { multipliers: { K: 1000 } };
    expect(wageParser.parse('250K zł p/tyg', { decimalSeparator: ',' }, null, lang)).toBe(250000);
    expect(wageParser.parse('1.5K € p/w', {}, null, lang)).toBe(1500);
  });

  it('reads a dotted frequency abbreviation at the end of the value', () => {
    const wageParser = new WageParser();
    const lang = { multipliers: { K: 1000 } };
    const weekly = { getWageMultiplier: (freq: string) => (freq === 'weekly' ? 52 : 1) };
    expect(wageParser.parse('250K zł tyg.', { decimalSeparator: ',' }, weekly, lang)).toBe(
      13000000
    );
  });

  it('should detect weekly frequency (p/w, p/tyg)', () => {
    const normConfig = {
      getWageMultiplier: (freq: string) => {
        if (freq === 'weekly') return 52;
        if (freq === 'monthly') return 12;
        return 1;
      }
    };
    const result = parser.parse('1000 p/w', {}, normConfig);
    expect(result).toBe(52000); // 1000 * 52
  });

  it('should detect monthly frequency (p/m, p/mies)', () => {
    const normConfig = {
      getWageMultiplier: (freq: string) => (freq === 'monthly' ? 12 : 1)
    };
    // Polish format from fixture: "18 000 € p/m"
    expect(parser.parse('18000 p/m', {}, normConfig)).toBe(216000);
  });

  it('should detect Polish weekly format (p/tyg)', () => {
    const normConfig = {
      getWageMultiplier: (freq: string) => (freq === 'weekly' ? 52 : 1)
    };
    expect(parser.parse('50000 p/tyg', {}, normConfig)).toBe(2600000);
  });

  it('should default to yearly when no frequency indicator', () => {
    const normConfig = {
      getWageMultiplier: (freq: string) => {
        if (freq === 'yearly') return 1;
        return 12;
      }
    };
    expect(parser.parse('100000', {}, normConfig)).toBe(100000);
  });

  it('should return null for empty input', () => {
    expect(parser.parse('')).toBeNull();
    expect(parser.parse(null)).toBeNull();
    expect(parser.parse('-')).toBeNull();
  });
});

// ============================================================================
// UniversalParser (routing)
// ============================================================================

describe('UniversalParser', () => {
  let parser: any;
  beforeAll(() => {
    parser = new UniversalParser();
  });

  it('should route attribute type to AttributeParser', () => {
    expect(parser.parse('14', { type: 'attribute' })).toBe(14);
    expect(parser.parse('7-14', { type: 'attribute' })).toBe(11);
  });

  it('should route statistic type to StatisticParser', () => {
    expect(parser.parse('7.18', { type: 'statistic' })).toBe(7.18);
  });

  it('should route currency type to CurrencyParser', () => {
    expect(parser.parse('1000', { type: 'currency' })).toBe(1000);
  });

  it('should route currency with supportsFrequency to WageParser', () => {
    const result = parser.parse('1000', { supportsFrequency: true, type: 'currency' });
    expect(result).toBe(1000);
  });

  it('should route date type to DateParser', () => {
    const result = parser.parse(
      '12.3.1997',
      { type: 'date' },
      { dateFormat: { format: 'DD/MM', separator: '.' } }
    );
    expect(result).toBe('1997-03-12');
  });

  it('should pass through string type', () => {
    expect(parser.parse('hello', { type: 'string' })).toBe('hello');
    expect(parser.parse('world', { type: 'string_pass_through' })).toBe('world');
  });

  it('should pass through when no schema', () => {
    expect(parser.parse('raw', null)).toBe('raw');
    expect(parser.parse('raw')).toBe('raw');
  });

  it('should parse integer type', () => {
    expect(parser.parse('42', { type: 'integer' })).toBe(42);
    expect(parser.parse('', { type: 'integer' })).toBeNull();
    expect(parser.parse('-', { type: 'integer' })).toBeNull();
  });

  it('should parse integer with thousand separators', () => {
    expect(parser.parse('2,580', { type: 'integer' }, { thousandSeparator: ',' })).toBe(2580);
  });

  it('should parse physical type', () => {
    expect(parser.parse('180cm', { type: 'physical' })).toBe(180);
    expect(parser.parse('75.5kg', { type: 'physical' })).toBe(75.5);
  });

  it('should parse physical with comma decimal', () => {
    expect(parser.parse('75,5kg', { type: 'physical' }, { decimalSeparator: ',' })).toBe(75.5);
  });

  it('should parse enum with translation', () => {
    const langConfig = {
      valueTranslations: {
        foot_strength: { 'Bardzo mocna': 'Very Strong', Słaba: 'Weak' }
      }
    };
    expect(
      parser.parse('Bardzo mocna', { id: 'basic_left_foot', type: 'enum' }, {}, null, langConfig)
    ).toBe('Very Strong');
  });

  it('should return enum value unchanged if no translation found', () => {
    expect(parser.parse('Unknown', { id: 'basic_left_foot', type: 'enum' }, {}, null, {})).toBe(
      'Unknown'
    );
  });

  it('should handle unknown type (pass through)', () => {
    expect(parser.parse('test', { type: 'unknown_type' })).toBe('test');
  });
});
