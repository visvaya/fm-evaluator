import { describe, expect, it } from 'vitest';

import { allStrings, seededStrings } from '../utils/seededStrings';

import { OCR_CORRECTIONS, correctCommonOCRErrors, withoutSerieSuffix } from './ocrMatching';

// The two letter-run corrections before they gained a lookbehind, kept as the oracle.
/* oxlint-disable regexp/no-super-linear-move, regexp/no-obscure-range -- reference implementation under test */
const OLD_LETTER_RUN_PATTERNS = new Map([
  ['ll', /([A-ZÀ-ÿ]{3,})ll\b/gi],
  ['li', /([A-ZÀ-ÿ]{3,})li\b/gi]
]);
/* oxlint-enable regexp/no-super-linear-move, regexp/no-obscure-range */

// The corrections list with the two letter-run entries swapped back to their former patterns.
const ORACLE_CORRECTIONS = OCR_CORRECTIONS.map(({ pattern, replacement }) => {
  const old =
    replacement === '$1 II' ? OLD_LETTER_RUN_PATTERNS.get(pattern.source.slice(-4, -2)) : undefined;
  return { pattern: old ?? pattern, replacement };
});

const oldCorrect = (text: string): string => {
  let corrected = text;
  for (const { pattern, replacement } of ORACLE_CORRECTIONS) {
    corrected = corrected.replace(pattern, replacement);
  }
  return corrected;
};

// Letters inside and outside the ASCII word characters, the "ll"/"li" endings, and breaks.
const LETTERS = ['A', 'b', 'l', 'L', 'i', 'I', 'À', 'é', '1', '_', ' ', '-'];
// One of each kind for the exhaustive run, which needs length 5 for a match (3 letters and "ll")
// and stays within the test timeout on a loaded machine: an ASCII letter, the two endings, an
// upper-case L, a letter that is not a word character, a word character that is not a letter,
// and a break.
const KINDS = ['A', 'l', 'L', 'i', 'À', '1', ' '];

const corrections = (texts: readonly string[]): string[] =>
  texts
    .filter((text) => correctCommonOCRErrors(text) !== oldCorrect(text))
    .map((text) => JSON.stringify(text));

// The replacement withoutSerieSuffix took over, kept as the oracle for the equivalence tests.
// oxlint-disable-next-line regexp/no-super-linear-move -- reference implementation under test
const oldWithoutSerie = (text: string): string => text.replaceAll(/\s*serie\s*[a-d]/gi, '').trim();

const ALPHABET = ['s', 'e', 'r', 'i', 'a', 'B', 'x', ' ', '\t'];

const differences = (texts: readonly string[]): string[] =>
  texts
    .filter((text) => withoutSerieSuffix(text) !== oldWithoutSerie(text))
    .map((text) => JSON.stringify(text));

describe('correctCommonOCRErrors', () => {
  it('splits a roman numeral glued to a league name', () => {
    expect(correctCommonOCRErrors('Ligall')).toBe('Liga II');
    expect(correctCommonOCRErrors('Seriell 2')).toBe('Serie II 2');
  });

  it('swaps exactly the two letter-run entries in the oracle', () => {
    const swapped = ORACLE_CORRECTIONS.filter(
      ({ pattern }, index) => pattern.source !== OCR_CORRECTIONS[index]?.pattern.source
    );
    expect(swapped.map(({ pattern }) => pattern.source)).toEqual(
      [...OLD_LETTER_RUN_PATTERNS.values()].map((pattern) => pattern.source)
    );
  });

  it('matches the former corrections on every string up to length 5', () => {
    expect(corrections(allStrings(KINDS, 5))).toEqual([]);
  });

  it('matches the former corrections on seeded random strings', () => {
    const texts = seededStrings({ alphabet: LETTERS, count: 40_000, maxLength: 16, seed: 5 });
    expect(corrections(texts)).toEqual([]);
  });

  it('stays linear on a long letter run', () => {
    const started = performance.now();
    expect(correctCommonOCRErrors('A'.repeat(20_000))).toBe('A'.repeat(20_000));
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('withoutSerieSuffix', () => {
  it('removes the serie letter like the old pattern', () => {
    expect(withoutSerieSuffix('campeonato brasileiro serie a')).toBe('campeonato brasileiro');
    expect(withoutSerieSuffix('serie a serie b')).toBe('');
  });

  it('matches the old pattern on every string up to length 6', () => {
    expect(differences(allStrings(ALPHABET, 6))).toEqual([]);
  });

  it('matches the old pattern on seeded strings built from serie words', () => {
    const words = ['serie', 'serieb', ' ', '  ', 'a', 'x', 'serie a', '\t'];
    const texts = seededStrings({ alphabet: words, count: 30_000, maxLength: 10, seed: 7 });
    expect(differences(texts)).toEqual([]);
  });

  it('stays linear on a long whitespace run', () => {
    const started = performance.now();
    expect(withoutSerieSuffix(`x${' '.repeat(30_000)}serie`)).toBe(`x${' '.repeat(30_000)}serie`);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
