import { describe, expect, it } from 'vitest';

import { allStrings, seededStrings } from './seededStrings';
import { splitTrailingParenthesis } from './splitTrailingParenthesis';

// The pattern splitTrailingParenthesis replaces, kept as the oracle for the equivalence tests.
// oxlint-disable-next-line regexp/no-super-linear-backtracking -- reference implementation under test
const OLD_PATTERN = /^(.+?)\s*\(([^)]+)\)$/;

const oracle = (text: string): null | readonly [string, string] => {
  const match = OLD_PATTERN.exec(text);
  return match ? [match[1] ?? '', match[2] ?? ''] : null;
};

const mismatches = (texts: readonly string[]): string[] =>
  texts
    .filter(
      (text) => JSON.stringify(splitTrailingParenthesis(text)) !== JSON.stringify(oracle(text))
    )
    .map((text) => JSON.stringify(text));

const ch = (codePoint: number): string => String.fromCodePoint(codePoint);

// Brackets, letters, a slash, plain and non-breaking spaces and a line terminator.
const ALPHABET = ['a', 'B', '/', '(', ')', ' ', ch(0xa0), ch(0x0a)];

describe('splitTrailingParenthesis', () => {
  it('splits positions like the old pattern', () => {
    expect(splitTrailingParenthesis('D/WB (L)')).toEqual(['D/WB', 'L']);
    expect(splitTrailingParenthesis('M (RC)')).toEqual(['M', 'RC']);
    expect(splitTrailingParenthesis('GK')).toBeNull();
    expect(splitTrailingParenthesis('(L)')).toBeNull();
    expect(splitTrailingParenthesis('M ()')).toBeNull();
  });

  it('matches the old pattern on every string up to length 6', () => {
    expect(mismatches(allStrings(ALPHABET, 6))).toEqual([]);
  });

  it('matches the old pattern on seeded random strings up to length 30', () => {
    const texts = seededStrings({ alphabet: ALPHABET, count: 20_000, maxLength: 30, seed: 7 });
    expect(mismatches(texts)).toEqual([]);
  });

  it('stays linear on input that made the old pattern backtrack', () => {
    const started = performance.now();
    expect(splitTrailingParenthesis(`a${' '.repeat(30_000)}x`)).toBeNull();
    // Cubic for the old pattern, so a shorter run already takes seconds there.
    expect(splitTrailingParenthesis(`a${'('.repeat(2000)}`)).toBeNull();
    expect(performance.now() - started).toBeLessThan(500);
  });
});
