// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { getPositionSummary } from './positionSummary';

describe('getPositionSummary', () => {
  it('separates primary and secondary positions and filters placeholder values', () => {
    const summary = getPositionSummary({
      pos2Array: ['OP (P)', '-'],
      position: 'P (P)',
      positionArray: ['P (P)', 'OP (P)']
    } as never);

    expect(summary.primary).not.toBe('');
    expect(summary.secondary).not.toBeNull();
  });
});
