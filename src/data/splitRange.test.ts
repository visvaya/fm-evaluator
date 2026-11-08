import { describe, expect, it } from 'vitest';

import { allStrings, seededStrings } from '../utils/seededStrings';

import { getNumericValue } from './getNumericValue';
import { splitRange } from './splitRange';

// The pattern splitRange replaces, kept as the oracle for the equivalence tests.
// oxlint-disable-next-line regexp/no-super-linear-backtracking -- reference implementation under test
const OLD_RANGE_RE = /^\s*(.+?)\s*[-–\u2014]\s*(.+?)\s*$/;

const oracle = (text: string): null | readonly [string, string] => {
  const match = OLD_RANGE_RE.exec(text);
  return match ? [match[1] ?? '', match[2] ?? ''] : null;
};

const mismatches = (texts: readonly string[]): string[] =>
  texts
    .filter((text) => JSON.stringify(splitRange(text)) !== JSON.stringify(oracle(text)))
    .map((text) => JSON.stringify(text));

const ch = (codePoint: number): string => String.fromCodePoint(codePoint);

// Characters that exercise every branch: digits, letters, the three dashes,
// plain and non-breaking spaces, a tab, line terminators that `.` does not match,
// and a character outside the basic plane (two code units for the old pattern).
const ALPHABET = [
  '1',
  'a',
  '-',
  ch(0x2013),
  ch(0x2014),
  ' ',
  ch(0xa0),
  ch(0x0a),
  ch(0x0d),
  ch(0x2028),
  ch(0x09),
  ch(0x10000)
];

describe('splitRange', () => {
  it('splits typical ranges like the old pattern', () => {
    expect(splitRange('12-15')).toEqual(['12', '15']);
    expect(splitRange(' 1K € - 6K € ')).toEqual(['1K €', '6K €']);
    expect(splitRange(`3 ${ch(0x2013)} 4`)).toEqual(['3', '4']);
    expect(splitRange('-5')).toBeNull();
    expect(splitRange('5-')).toBeNull();
    expect(splitRange('')).toBeNull();
  });

  it('matches the old pattern on every string up to length 4', () => {
    expect(mismatches(allStrings(ALPHABET, 4))).toEqual([]);
  });

  it('matches the old pattern on seeded random strings up to length 40', () => {
    const texts = seededStrings({ alphabet: ALPHABET, count: 20_000, maxLength: 40, seed: 7 });
    expect(mismatches(texts)).toEqual([]);
  });

  it('stays linear on input that made the old pattern backtrack', () => {
    const text = `1${' '.repeat(20_000)}1-`;
    const started = performance.now();
    expect(splitRange(text)).toBeNull();
    expect(getNumericValue(text, true)).toBe(11);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
