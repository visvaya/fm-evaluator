import { describe, expect, it } from 'vitest';

import { evaluateBundleBudget, formatKiB } from './bundle-budget.mjs';

const BUDGET = { totalJsBytesMax: 1000, largestChunkBytesMax: 600 };

describe('evaluateBundleBudget', () => {
  it('passes within limits and reports sizes', () => {
    const result = evaluateBundleBudget({
      chunks: [
        { name: 'a.js', bytes: 500 },
        { name: 'b.js', bytes: 300 }
      ],
      budget: BUDGET
    });
    expect(result).toEqual({
      totalBytes: 800,
      largest: { name: 'a.js', bytes: 500 },
      violations: []
    });
  });

  it('fails when the total exceeds the limit', () => {
    const result = evaluateBundleBudget({
      chunks: [
        { name: 'a.js', bytes: 550 },
        { name: 'b.js', bytes: 550 }
      ],
      budget: BUDGET
    });
    expect(result.violations).toEqual([{ kind: 'total', bytes: 1100, limitBytes: 1000 }]);
  });

  it('fails when the largest chunk exceeds the limit', () => {
    const result = evaluateBundleBudget({
      chunks: [{ name: 'big.js', bytes: 700 }],
      budget: BUDGET
    });
    expect(result.violations).toEqual([
      { kind: 'largest', name: 'big.js', bytes: 700, limitBytes: 600 }
    ]);
  });

  it('handles an empty chunk list', () => {
    expect(evaluateBundleBudget({ chunks: [], budget: BUDGET })).toEqual({
      totalBytes: 0,
      largest: null,
      violations: []
    });
  });
});

describe('formatKiB', () => {
  it('formats bytes as KiB with one decimal', () => {
    expect(formatKiB(1536)).toBe('1.5 KiB');
  });
});
