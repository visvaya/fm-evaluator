import { describe, expect, it } from 'vitest';

import { nodeFloorProblem } from './node-floor.mjs';

describe('nodeFloorProblem', () => {
  it('accepts the floor itself and newer releases', () => {
    expect(nodeFloorProblem({ nodeVersion: 'v26.12.1', range: '>=26.12.1' })).toBeNull();
    expect(nodeFloorProblem({ nodeVersion: 'v26.13.0', range: '>=26.12.1' })).toBeNull();
    expect(nodeFloorProblem({ nodeVersion: 'v27.0.0', range: '>=26.12.1' })).toBeNull();
  });

  it('rejects an older patch, minor or major release', () => {
    expect(nodeFloorProblem({ nodeVersion: 'v26.12.0', range: '>=26.12.1' })).toBe(
      'Node 26.12.0 is older than the required >=26.12.1'
    );
    expect(nodeFloorProblem({ nodeVersion: 'v26.9.9', range: '>=26.12.1' })).not.toBeNull();
    expect(nodeFloorProblem({ nodeVersion: 'v24.22.2', range: '>=26.12.1' })).not.toBeNull();
  });

  it('compares numerically, not as text', () => {
    expect(nodeFloorProblem({ nodeVersion: 'v26.100.0', range: '>=26.12.1' })).toBeNull();
  });

  it('throws on a range it cannot read, so a changed engines field is not ignored', () => {
    expect(() => nodeFloorProblem({ nodeVersion: 'v26.12.1', range: '^26.12.1' })).toThrow(
      'only ">=x.y.z" is supported'
    );
  });
});
