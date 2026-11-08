import { describe, expect, it } from 'vitest';

import { IMPORT_LIMITS } from '@/config/importLimits';

import { allStrings, seededStrings } from '../utils/seededStrings';

import {
  getTeamPossession,
  normalizeClubName,
  removeTeamPossession,
  resetTeamPossession,
  setTeamPossession,
  splitPossessionLine,
  updatePossessionMapFromText
} from './possessionUtils';

// The pattern splitPossessionLine replaces, kept as the oracle for the equivalence tests.
const OLD_POSSESSION_LINE_RE =
  // oxlint-disable-next-line regexp/no-super-linear-backtracking, no-control-regex -- reference implementation under test
  /^\s*(.+?)[\u000A-\u000D \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*(?:\t|(?:\t\s*)?[-:;])\s*([\d.,]+)\s*(?:%\s*)?$/;

const oracle = (line: string): null | readonly [string, string] => {
  const match = OLD_POSSESSION_LINE_RE.exec(line);
  return match ? [match[1] ?? '', match[2] ?? ''] : null;
};

const ch = (codePoint: number): string => String.fromCodePoint(codePoint);

// Name letters, digits, every separator, the percent sign, tabs and other whitespace,
// and line terminators that only a trimmed line can still hold inside.
const LINE_ALPHABET = ['A', '5', '.', ',', ':', ';', '-', '%', ' ', ch(0x09), ch(0xa0), ch(0x0d)];

// The function receives trimmed lines only, like the pattern did.
const mismatches = (texts: readonly string[]): string[] =>
  texts
    .map((text) => text.trim())
    .filter((line) => JSON.stringify(splitPossessionLine(line)) !== JSON.stringify(oracle(line)))
    .map((line) => JSON.stringify(line));

describe('splitPossessionLine', () => {
  it('matches the old pattern on every trimmed string up to length 5', () => {
    expect(mismatches(allStrings(LINE_ALPHABET, 5))).toEqual([]);
  });

  it('matches the old pattern on seeded random trimmed strings up to length 30', () => {
    const texts = seededStrings({ alphabet: LINE_ALPHABET, count: 30_000, maxLength: 30, seed: 7 });
    expect(mismatches(texts)).toEqual([]);
  });

  it('stays linear on a long whitespace run before the number', () => {
    const started = performance.now();
    expect(splitPossessionLine(`A${' '.repeat(30_000)}5`)).toBeNull();
    expect(splitPossessionLine(`A${ch(0x09).repeat(30_000)}5`)).toEqual(['A', '5']);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('normalizeClubName', () => {
  it('lowercases and trims', () => {
    expect(normalizeClubName('  Manchester City  ')).toBe('manchester city');
  });

  it('returns empty string for falsy input', () => {
    expect(normalizeClubName(null)).toBe('');
    expect(normalizeClubName(undefined)).toBe('');
    expect(normalizeClubName('')).toBe('');
  });

  it('strips diacritics', () => {
    const result = normalizeClubName('Legia Warszawa');
    expect(result).toBe('legia warszawa');
  });
});

describe('setTeamPossession / getTeamPossession', () => {
  it('sets and gets a value', () => {
    const map = new Map<string, number>();
    setTeamPossession(map, 'Arsenal', 55);
    expect(getTeamPossession(map, 'Arsenal')).toBe(55);
  });

  it('normalizes club name on set and get', () => {
    const map = new Map<string, number>();
    setTeamPossession(map, 'Arsenal FC', 60);
    expect(getTeamPossession(map, 'arsenal fc')).toBe(60);
  });

  it('rounds fractional possession', () => {
    const map = new Map<string, number>();
    setTeamPossession(map, 'Club', 55.7);
    expect(getTeamPossession(map, 'Club')).toBe(56);
  });

  it('clamps possession to [0, 100]', () => {
    const map = new Map<string, number>();
    setTeamPossession(map, 'Club A', -10);
    expect(getTeamPossession(map, 'Club A')).toBe(0);
    setTeamPossession(map, 'Club B', 150);
    expect(getTeamPossession(map, 'Club B')).toBe(100);
  });

  it('parses string possession values with comma decimal', () => {
    const map = new Map<string, number>();
    setTeamPossession(map, 'Club', '54,3');
    expect(getTeamPossession(map, 'Club')).toBe(54);
  });

  it('ignores NaN possession strings', () => {
    const map = new Map<string, number>();
    setTeamPossession(map, 'Club', 'bad');
    expect(getTeamPossession(map, 'Club')).toBeNull();
  });

  it('returns null for missing club', () => {
    const map = new Map<string, number>();
    expect(getTeamPossession(map, 'NonExistent')).toBeNull();
  });

  it('returns null for null / empty clubName', () => {
    const map = new Map<string, number>();
    expect(getTeamPossession(map, null)).toBeNull();
    expect(getTeamPossession(map, '')).toBeNull();
  });

  it('does not set for null / empty clubName', () => {
    const map = new Map<string, number>();
    setTeamPossession(map, null, 50);
    setTeamPossession(map, '', 50);
    expect(map.size).toBe(0);
  });
});

describe('removeTeamPossession', () => {
  it('removes an existing entry', () => {
    const map = new Map<string, number>();
    setTeamPossession(map, 'Arsenal', 55);
    removeTeamPossession(map, 'Arsenal');
    expect(getTeamPossession(map, 'Arsenal')).toBeNull();
  });

  it('is a no-op for non-existent club', () => {
    const map = new Map<string, number>();
    removeTeamPossession(map, 'Ghost Club');
    expect(map.size).toBe(0);
  });
});

describe('resetTeamPossession', () => {
  it('clears all entries', () => {
    const map = new Map<string, number>();
    setTeamPossession(map, 'Arsenal', 55);
    setTeamPossession(map, 'Chelsea', 45);
    resetTeamPossession(map);
    expect(map.size).toBe(0);
  });
});

describe('updatePossessionMapFromText', () => {
  it('parses tab-separated lines', () => {
    const map = new Map<string, number>();
    updatePossessionMapFromText(map, 'Arsenal\t55\nChelsea\t45');
    expect(getTeamPossession(map, 'Arsenal')).toBe(55);
    expect(getTeamPossession(map, 'Chelsea')).toBe(45);
  });

  it('skips a line longer than the pasted line limit', () => {
    const map = new Map<string, number>();
    const longName = 'A'.repeat(IMPORT_LIMITS.pastedLineLengthChars);
    updatePossessionMapFromText(map, `${longName}: 60\nChelsea: 45`);
    expect(getTeamPossession(map, longName)).toBeNull();
    expect(getTeamPossession(map, 'Chelsea')).toBe(45);
  });

  it('handles a long line without a separator quickly', () => {
    const started = performance.now();
    updatePossessionMapFromText(new Map<string, number>(), `A${' '.repeat(100_000)}B`);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('parses colon-separated lines', () => {
    const map = new Map<string, number>();
    updatePossessionMapFromText(map, 'Arsenal: 60');
    expect(getTeamPossession(map, 'Arsenal')).toBe(60);
  });

  it('parses dash-separated lines', () => {
    const map = new Map<string, number>();
    updatePossessionMapFromText(map, 'Arsenal - 60');
    expect(getTeamPossession(map, 'Arsenal')).toBe(60);
  });

  it('strips trailing percent sign', () => {
    const map = new Map<string, number>();
    updatePossessionMapFromText(map, 'Arsenal\t55%');
    expect(getTeamPossession(map, 'Arsenal')).toBe(55);
  });

  it('ignores empty lines', () => {
    const map = new Map<string, number>();
    updatePossessionMapFromText(map, '\nArsenal\t55\n\nChelsea\t45\n');
    expect(map.size).toBe(2);
  });

  it('ignores lines without valid number', () => {
    const map = new Map<string, number>();
    updatePossessionMapFromText(map, 'Arsenal\tabc');
    expect(map.size).toBe(0);
  });

  it('is a no-op for falsy input', () => {
    const map = new Map<string, number>();
    updatePossessionMapFromText(map, null);
    updatePossessionMapFromText(map, undefined);
    updatePossessionMapFromText(map, '');
    expect(map.size).toBe(0);
  });

  it('handles comma decimal possession values', () => {
    const map = new Map<string, number>();
    updatePossessionMapFromText(map, 'Arsenal\t54,3');
    expect(getTeamPossession(map, 'Arsenal')).toBe(54);
  });
});
