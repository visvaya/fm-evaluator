import { describe, expect, it } from 'vitest';

import { firstParenthesised, withoutTrailingParenthesis } from './parenthesised';
import { allStrings, seededStrings } from './seededStrings';

// The patterns these helpers replace, kept as the oracles for the equivalence tests.
/* oxlint-disable regexp/no-super-linear-move -- reference implementation under test */
const oldFirst = (text: string): null | string => /\([^)]+\)/.exec(text)?.[0] ?? null;
const oldWithout = (text: string): string => text.replace(/\s*\([^)]+\)\s*$/, '');
/* oxlint-enable regexp/no-super-linear-move */

const ch = (codePoint: number): string => String.fromCodePoint(codePoint);

// Position letters, a slash, brackets, spaces, NBSP and a line terminator.
const ALPHABET = ['D', 'L', '/', '(', ')', ' ', ch(0xa0), ch(0x0a)];

const differences = (texts: readonly string[]): string[] =>
  texts
    .filter(
      (text) =>
        firstParenthesised(text) !== oldFirst(text) ||
        withoutTrailingParenthesis(text) !== oldWithout(text)
    )
    .map((text) => JSON.stringify(text));

describe('parenthesised helpers', () => {
  it('read and remove position sides like the old patterns', () => {
    expect(firstParenthesised('D/WB (RLC)')).toBe('(RLC)');
    expect(firstParenthesised('GK')).toBeNull();
    expect(withoutTrailingParenthesis('AM (RL) ')).toBe('AM');
    expect(withoutTrailingParenthesis('ST ()')).toBe('ST ()');
  });

  it('match the old patterns on every string up to length 6', () => {
    expect(differences(allStrings(ALPHABET, 6))).toEqual([]);
  });

  it('match the old patterns on seeded random strings up to length 30', () => {
    const texts = seededStrings({ alphabet: ALPHABET, count: 30_000, maxLength: 30, seed: 7 });
    expect(differences(texts)).toEqual([]);
  });

  it('stay linear on runs that made the old patterns quadratic', () => {
    const started = performance.now();
    expect(firstParenthesised(`x()${'('.repeat(30_000)}`)).toBeNull();
    expect(withoutTrailingParenthesis(`A${' '.repeat(30_000)}(`)).toBe(`A${' '.repeat(30_000)}(`);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
