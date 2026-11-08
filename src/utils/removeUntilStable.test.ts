import { describe, expect, it } from 'vitest';

import { removeUntilStable } from './removeUntilStable';

describe('removeUntilStable', () => {
  it('removes a match that an earlier removal created', () => {
    expect(removeUntilStable('<sty<style></style>le>a</style>b', [/<style>.*?<\/style>/g])).toBe(
      'b'
    );
  });

  it('removes a match of one pattern that another pattern created', () => {
    expect(removeUntilStable('<st<x>yle>', [/<style>/g, /<x>/g])).toBe('');
  });

  it('returns text without matches unchanged', () => {
    expect(removeUntilStable('plain', [/<style>/g])).toBe('plain');
  });
});
