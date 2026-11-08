import { describe, expect, it } from 'vitest';

import { allStrings, seededStrings } from '../utils/seededStrings';

import { matchPossessionLine } from './ocrLineMatch';

// The patterns matchPossessionLine replaces, in their order, kept as the oracle.
/* oxlint-disable regexp/no-super-linear-backtracking -- reference implementation under test */
const OLD_PATTERNS = [
  /^\d+(st|nd|rd|th|\.)\s+(.+?)\s*[-:]\s*(\d{1,3}(?:[.,]\d+)?)\s?%$/,
  /^\d+(st|nd|rd|th|\.)\s+(.+?)\s+(\d{1,3}(?:[.,]\d+)?)\s?%$/,
  /^(\d{1,3}(?:[.,]\d+)?)\s?%\s+(.+)$/,
  /^(.+?)\s*[-:]\s*(\d{1,3}(?:[.,]\d+)?)\s?%$/,
  /^(.+?)\s+(\d{1,3}(?:[.,]\d+)?)\s?%$/,
  /^(.+?)\s*[-:]\s*(\d{1,3}[.,]\d+)\s?%$/,
  /^(.+?)\s*(?:[-:]\s*)?(\d{1,3}(?:[.,]\d+)?)$/,
  /^(.+?)\s*\((\d{1,3}(?:[.,]\d+)?)\s?%?\)$/
];
/* oxlint-enable regexp/no-super-linear-backtracking */

// The groups the caller read for each former pattern: [name, possession].
const oracle = (line: string): null | readonly [string, string] => {
  for (const [index, pattern] of OLD_PATTERNS.entries()) {
    const match = pattern.exec(line);
    if (!match) continue;
    if (index <= 1) return [match[2] ?? '', match[3] ?? ''];
    if (index === 2) return [match[2] ?? '', match[1] ?? ''];
    return [match[1] ?? '', match[2] ?? ''];
  }
  return null;
};

// The caller passes trimmed lines only.
const mismatches = (texts: readonly string[]): string[] =>
  texts
    .map((text) => text.trim())
    .filter((line) => JSON.stringify(matchPossessionLine(line)) !== JSON.stringify(oracle(line)))
    .map((line) => JSON.stringify(line));

const ch = (codePoint: number): string => String.fromCodePoint(codePoint);

// Rank suffixes, a name letter, digits, decimal marks, separators, "%", brackets,
// spaces, a tab and a line terminator that only the inside of a trimmed line can hold.
const ALPHABET = [
  '1',
  '5',
  's',
  't',
  'A',
  '.',
  ',',
  '-',
  ':',
  '%',
  '(',
  ')',
  ' ',
  ch(0x09),
  ch(0x0d)
];
const RANKS = ['1st ', '2. ', '10th  ', `3rd${ch(0x09)} `, '55% ', `1st ${ch(0x0d)} `];

describe('matchPossessionLine', () => {
  it('reads the usual OCR line shapes', () => {
    expect(matchPossessionLine('1st Arsenal - 55%')).toEqual(['Arsenal', '55']);
    expect(matchPossessionLine('2. Chelsea 48,5%')).toEqual(['Chelsea', '48,5']);
    expect(matchPossessionLine('55% Arsenal')).toEqual(['Arsenal', '55']);
    expect(matchPossessionLine('Arsenal: 55.5%')).toEqual(['Arsenal', '55.5']);
    expect(matchPossessionLine('Arsenal 55')).toEqual(['Arsenal', '55']);
    expect(matchPossessionLine('Arsenal (55%)')).toEqual(['Arsenal', '55']);
    expect(matchPossessionLine('1st  - 55%')).toEqual([' ', '55']);
    expect(matchPossessionLine('Arsenal')).toBeNull();
  });

  it('matches the former patterns on every trimmed string up to length 4', () => {
    expect(mismatches(allStrings(ALPHABET, 4))).toEqual([]);
  });

  it('matches the former patterns on seeded random lines', () => {
    const plain = seededStrings({ alphabet: ALPHABET, count: 40_000, maxLength: 20, seed: 7 });
    const ranked = seededStrings({
      alphabet: ALPHABET,
      count: 40_000,
      maxLength: 14,
      seed: 11
    }).map((text, index) => `${RANKS[index % RANKS.length] ?? ''}${text}`);
    expect(mismatches([...plain, ...ranked])).toEqual([]);
  });

  it('stays linear on whitespace runs that made the former patterns backtrack', () => {
    const started = performance.now();
    expect(matchPossessionLine(`1st${' '.repeat(20_000)}x`)).toBeNull();
    expect(matchPossessionLine(`A${' '.repeat(20_000)}x`)).toBeNull();
    expect(performance.now() - started).toBeLessThan(500);
  });
});
