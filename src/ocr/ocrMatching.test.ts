import { describe, expect, it } from 'vitest';

import { allStrings, seededStrings } from '../utils/seededStrings';

import { withoutSerieSuffix } from './ocrMatching';

// The replacement withoutSerieSuffix took over, kept as the oracle for the equivalence tests.
// oxlint-disable-next-line regexp/no-super-linear-move -- reference implementation under test
const oldWithoutSerie = (text: string): string => text.replaceAll(/\s*serie\s*[a-d]/gi, '').trim();

const ALPHABET = ['s', 'e', 'r', 'i', 'a', 'B', 'x', ' ', '\t'];

const differences = (texts: readonly string[]): string[] =>
  texts
    .filter((text) => withoutSerieSuffix(text) !== oldWithoutSerie(text))
    .map((text) => JSON.stringify(text));

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
