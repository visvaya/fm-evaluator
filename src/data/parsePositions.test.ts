import { describe, expect, it } from 'vitest';

import { parsePositions } from './parsePositions';

describe('parsePositions', () => {
  // ── edge cases ────────────────────────────────────────────────────────────

  it('returns [] for empty string', () => {
    expect(parsePositions('')).toEqual([]);
  });

  it('returns [] for null', () => {
    expect(parsePositions(null)).toEqual([]);
  });

  it('returns [] for undefined', () => {
    expect(parsePositions(undefined)).toEqual([]);
  });

  it('returns [] for non-string values', () => {
    expect(parsePositions(42)).toEqual([]);
    expect(parsePositions({})).toEqual([]);
  });

  // ── single position ───────────────────────────────────────────────────────

  it('parses a single position without parentheses', () => {
    expect(parsePositions('GK')).toEqual(['GK']);
  });

  it('parses a position with parentheses modifier', () => {
    expect(parsePositions('D (L)')).toEqual(['D (L)']);
  });

  // ── comma-separated positions ─────────────────────────────────────────────

  it('splits comma-separated positions', () => {
    expect(parsePositions('GK, D (L)')).toEqual(['GK', 'D (L)']);
  });

  it('trims whitespace around commas', () => {
    expect(parsePositions('GK ,  D (L)')).toEqual(['GK', 'D (L)']);
  });

  it('deduplicates identical positions', () => {
    expect(parsePositions('GK, GK')).toEqual(['GK']);
  });

  // ── slash notation (multiple sides) ──────────────────────────────────────

  it('expands D (RL) with multi-letter parentheses into two positions', () => {
    const result = parsePositions('D (RL)');
    expect(result).toContain('D (R)');
    expect(result).toContain('D (L)');
    expect(result).toHaveLength(2);
  });

  it('expands D (RLC) into three positions', () => {
    const result = parsePositions('D (RLC)');
    expect(result).toContain('D (R)');
    expect(result).toContain('D (L)');
    expect(result).toContain('D (C)');
    expect(result).toHaveLength(3);
  });

  it('expands slash-separated roles with shared parentheses', () => {
    const result = parsePositions('D/WB (L)');
    expect(result).toContain('D (L)');
    expect(result).toContain('WB (L)');
    expect(result).toHaveLength(2);
  });

  it('expands slash roles with multi-letter shared parentheses', () => {
    const result = parsePositions('D/WB (RL)');
    expect(result).toContain('D (R)');
    expect(result).toContain('D (L)');
    expect(result).toContain('WB (R)');
    expect(result).toContain('WB (L)');
    expect(result).toHaveLength(4);
  });

  // ── complex real-world FM strings ─────────────────────────────────────────

  it('parses a full FM position string with multiple roles', () => {
    const result = parsePositions('GK, D (RL), WB (RL), M (RL)');
    expect(result).toContain('GK');
    expect(result).toContain('D (R)');
    expect(result).toContain('D (L)');
    expect(result).toContain('WB (R)');
    expect(result).toContain('WB (L)');
    expect(result).toContain('M (R)');
    expect(result).toContain('M (L)');
  });

  it('returns a flat unique array with no duplicates', () => {
    const result = parsePositions('D (RL), D (RL)');
    expect(result).toHaveLength(2);
    expect(new Set(result).size).toBe(result.length);
  });
});
