import { describe, expect, it } from 'vitest';

import { canonicalizeNation } from './ldcNations';

describe('canonicalizeNation', () => {
  it('maps FM country codes to Polish exonyms', () => {
    expect(canonicalizeNation('ENG')).toBe('Anglia');
  });

  it('maps full English country names to Polish exonyms', () => {
    expect(canonicalizeNation('England')).toBe('Anglia');
    expect(canonicalizeNation('Germany')).toBe('Niemcy');
  });

  it('keeps Polish exonyms unchanged', () => {
    expect(canonicalizeNation('Anglia')).toBe('Anglia');
  });

  it('keeps unknown values unchanged and normalizes empties', () => {
    expect(canonicalizeNation('Narnia')).toBe('Narnia');
    expect(canonicalizeNation('')).toBe('');
    expect(canonicalizeNation(null)).toBe('');
    expect(canonicalizeNation('  England  ')).toBe('Anglia');
  });
});
