import { describe, expect, it } from 'vitest';

import { normalizeHeader } from './normalizeHeader';

describe('normalizeHeader', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeHeader('  Name  ')).toBe('Name');
  });

  it('collapses internal multiple spaces to single space', () => {
    expect(normalizeHeader('First  Last')).toBe('First Last');
    expect(normalizeHeader('A   B   C')).toBe('A B C');
  });

  it('handles tab and newline as whitespace', () => {
    expect(normalizeHeader('A\tB')).toBe('A B');
    expect(normalizeHeader('A\nB')).toBe('A B');
  });

  it('returns non-string input unchanged', () => {
    expect(normalizeHeader(null)).toBeNull();
    expect(normalizeHeader(undefined)).toBeUndefined();
    expect(normalizeHeader(42 as any)).toBe(42);
  });

  it('handles empty string', () => {
    expect(normalizeHeader('')).toBe('');
  });

  it('applies NFC Unicode normalization', () => {
    // Precomposed vs decomposed é
    const decomposed = 'é'; // e + combining acute
    const precomposed = 'é'; // é
    expect(normalizeHeader(decomposed)).toBe(precomposed);
  });

  it('returns already-clean header unchanged', () => {
    expect(normalizeHeader('Pac')).toBe('Pac');
    expect(normalizeHeader('Transfer Value')).toBe('Transfer Value');
  });
});
