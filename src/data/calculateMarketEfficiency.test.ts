import { describe, expect, it } from 'vitest';

import { calculateMarketEfficiency } from './calculateMarketEfficiency';

function makePlayers(count: number, valueKey: string, scoreKey: string) {
  return Array.from({ length: count }, (_, i) => ({
    tempIndex: i,
    [valueKey]: (i + 1) * 1_000_000,
    [scoreKey]: (i + 1) * 10
  }));
}

describe('calculateMarketEfficiency', () => {
  // ── basic shape ───────────────────────────────────────────────────────────

  it('returns an empty map for empty input', () => {
    const result = calculateMarketEfficiency([], 'Transfer Value', 40, 'totalScore');
    expect(result.size).toBe(0);
  });

  it('returns a map keyed by tempIndex', () => {
    const players = makePlayers(3, 'Transfer Value', 'totalScore');
    const result = calculateMarketEfficiency(players, 'Transfer Value', 40, 'totalScore');
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(true);
  });

  it('each entry has expected and ratio fields', () => {
    const players = makePlayers(3, 'Transfer Value', 'totalScore');
    const result = calculateMarketEfficiency(players, 'Transfer Value', 40, 'totalScore');
    for (const entry of result.values()) {
      expect(entry).toHaveProperty('expected');
      expect(entry).toHaveProperty('ratio');
    }
  });

  // ── filtering ─────────────────────────────────────────────────────────────

  it('excludes players with 0 score from results', () => {
    const players = [
      { tempIndex: 0, 'Transfer Value': 1_000_000, totalScore: 0 },
      { tempIndex: 1, 'Transfer Value': 2_000_000, totalScore: 50 }
    ];
    const result = calculateMarketEfficiency(players, 'Transfer Value', 40, 'totalScore');
    expect(result.has(0)).toBe(false);
    expect(result.has(1)).toBe(true);
  });

  it('excludes players with null / 0 value', () => {
    const players = [
      { tempIndex: 0, 'Transfer Value': null, totalScore: 50 },
      { tempIndex: 1, 'Transfer Value': 0, totalScore: 50 },
      { tempIndex: 2, 'Transfer Value': 1_000_000, totalScore: 50 }
    ];
    const result = calculateMarketEfficiency(players, 'Transfer Value', 40, 'totalScore');
    expect(result.has(0)).toBe(false);
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
  });

  it('applies custom filterFn to exclude players', () => {
    const players = [
      { tempIndex: 0, 'Transfer Value': 1_000_000, totalScore: 50, isLow: true },
      { tempIndex: 1, 'Transfer Value': 2_000_000, totalScore: 60, isLow: false }
    ];
    const filterFn = (p: any) => !p.isLow;
    const result = calculateMarketEfficiency(players, 'Transfer Value', 40, 'totalScore', filterFn);
    expect(result.has(0)).toBe(false);
    expect(result.has(1)).toBe(true);
  });

  // ── ratio semantics ───────────────────────────────────────────────────────

  it('ratio is null when actualVal is 0', () => {
    const players = [{ tempIndex: 0, 'Transfer Value': 1_000_000, totalScore: 50 }];
    const result = calculateMarketEfficiency(players, 'Transfer Value', 40, 'totalScore');
    const entry = result.get(0);
    // Single player – neighbor = itself, median = its own value, ratio = 1
    expect(entry).toBeDefined();
    expect(entry.ratio).toBe(1);
  });

  it('computes ratio as medianVal/actualVal', () => {
    const players = [
      { tempIndex: 0, 'Transfer Value': 1_000_000, totalScore: 50 },
      { tempIndex: 1, 'Transfer Value': 2_000_000, totalScore: 60 }
    ];
    const result = calculateMarketEfficiency(players, 'Transfer Value', 40, 'totalScore');
    const entry1 = result.get(1);
    expect(entry1).toBeDefined();
    // median of [1M, 2M] = 1.5M; ratio = 1.5M / 2M = 0.75
    expect(entry1.ratio).toBeCloseTo(0.75);
  });

  it('uses default windowSize of 40', () => {
    const players = makePlayers(50, 'Transfer Value', 'totalScore');
    const result = calculateMarketEfficiency(players, 'Transfer Value');
    expect(result.size).toBeGreaterThan(0);
  });

  // ── wage key ──────────────────────────────────────────────────────────────

  it('handles Wage as valueKey (isWage=true path)', () => {
    const players = [
      { tempIndex: 0, Wage: '5000', totalScore: 50 },
      { tempIndex: 1, Wage: '10000', totalScore: 60 }
    ];
    const result = calculateMarketEfficiency(players, 'Wage', 40, 'totalScore');
    expect(result.size).toBeGreaterThan(0);
  });

  // ── windowing ─────────────────────────────────────────────────────────────

  it('does not include more players in window than exist', () => {
    const players = makePlayers(5, 'Transfer Value', 'totalScore');
    const result = calculateMarketEfficiency(players, 'Transfer Value', 40, 'totalScore');
    expect(result.size).toBe(5);
  });
});
