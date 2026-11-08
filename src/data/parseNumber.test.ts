import { describe, expect, it } from 'vitest';

import { seededStrings } from '../utils/seededStrings';

import { getNumericValue } from './getNumericValue';
import { parseNumber, stripUnitWords } from './parseNumber';

// The replacements stripUnitWords took over, kept as the oracle for the equivalence tests.
/* oxlint-disable regexp/no-super-linear-move -- reference implementation under test */
const oldStripUnitWords = (text: string): string =>
  text
    .replaceAll(/\s*km\s*/gi, '')
    .replaceAll(/\s*cm\s*/gi, '')
    .replaceAll(/\s*mm\s*/gi, '')
    .replaceAll(/\b(m)\b/gi, '')
    .trim()
    .replaceAll('€', '')
    .replaceAll(/\s*p\/[aw]/gi, '')
    .replaceAll(/\s*mln\s*/gi, 'M')
    .trim();
/* oxlint-enable regexp/no-super-linear-move */

const ch = (codePoint: number): string => String.fromCodePoint(codePoint);

// Letters of every unit word in both cases, separators, digits and several kinds of whitespace.
const ALPHABET = [
  'k',
  'm',
  'c',
  'M',
  'p',
  '/',
  'a',
  'w',
  'l',
  'n',
  '1',
  ',',
  '€',
  ' ',
  ch(0xa0),
  ch(0x0a)
];

describe('parseNumber', () => {
  it('reads values with units, currencies and wage periods', () => {
    expect(parseNumber('12 km')).toBe(12);
    expect(parseNumber('180 cm')).toBe(180);
    expect(parseNumber('1,5 mln €')).toBe(1_500_000);
    expect(parseNumber('25K € p/w')).toBe(25_000);
    expect(parseNumber('3 km km')).toBe(3);
    expect(parseNumber('-')).toBeNull();
  });

  it('strips unit words like the former patterns on seeded random strings', () => {
    const texts = seededStrings({ alphabet: ALPHABET, count: 30_000, maxLength: 24, seed: 7 });
    const mismatches = texts.filter((text) => stripUnitWords(text) !== oldStripUnitWords(text));
    expect(mismatches.map((text) => JSON.stringify(text))).toEqual([]);
  });

  it('stays linear on long whitespace runs that made the former patterns quadratic', () => {
    const text = `1${' '.repeat(20_000)}1-`;
    const started = performance.now();
    expect(parseNumber(text)).toBe(11);
    expect(getNumericValue(text, true)).toBe(11);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
