import { describe, expect, it } from 'vitest';

import { buildGraph, computeDepths, orderBridges, resolveSpecifier } from './legacy-graph.mjs';

const files = new Set([
  'src/a.ts',
  'src/lib/b.tsx',
  'src/parsing/c.js',
  'src/store/index.ts',
  'src/workers/w.worker.ts'
]);

describe('resolveSpecifier', () => {
  it('resolves relative, alias, index and .js-to-.ts specifiers', () => {
    expect(resolveSpecifier('src/lib/b.tsx', '../a', files)).toBe('src/a.ts');
    expect(resolveSpecifier('src/a.ts', '@/lib/b', files)).toBe('src/lib/b.tsx');
    expect(resolveSpecifier('src/a.ts', './parsing/c.js', files)).toBe('src/parsing/c.js');
    expect(resolveSpecifier('src/a.ts', './store', files)).toBe('src/store/index.ts');
    expect(resolveSpecifier('src/a.ts', './store.js', files)).toBe('src/store/index.ts');
    expect(resolveSpecifier('src/lib/b.tsx', '../a.js', files)).toBe('src/a.ts');
    expect(resolveSpecifier('src/a.ts', './workers/w.worker.ts?worker', files)).toBe(
      'src/workers/w.worker.ts'
    );
  });

  it('returns null for packages and misses', () => {
    expect(resolveSpecifier('src/a.ts', 'react', files)).toBeNull();
    expect(resolveSpecifier('src/a.ts', './missing', files)).toBeNull();
  });
});

const scans = [
  { file: 'src/leaf.js', imports: [] },
  { file: 'src/reader.js', imports: [] },
  { file: 'src/app.ts', imports: [{ specifier: './reader.js' }, { specifier: './leaf.js' }] },
  { file: 'src/x.ts', imports: [{ specifier: './y' }] },
  { file: 'src/y.ts', imports: [{ specifier: './x' }] }
];
const globalsByName = [
  { name: 'Leaf', kind: 'bridge', writes: ['src/leaf.js:9'], reads: ['src/reader.js:3'] },
  { name: 'Vendor', kind: 'external', writes: [], reads: ['src/reader.js:4'] },
  {
    name: 'Own',
    kind: 'bridge',
    writes: ['src/reader.js:1'],
    reads: ['src/reader.js:2', 'src/app.ts:5']
  }
];

describe('buildGraph and computeDepths', () => {
  const edges = buildGraph(scans, globalsByName);

  it('adds import edges and window edges from reader to definer', () => {
    expect(edges.get('src/reader.js')).toEqual([
      { to: 'src/leaf.js', kind: 'window', name: 'Leaf' }
    ]);
    expect(edges.get('src/app.ts')).toEqual([
      { to: 'src/reader.js', kind: 'import' },
      { to: 'src/leaf.js', kind: 'import' },
      { to: 'src/reader.js', kind: 'window', name: 'Own' }
    ]);
  });

  it('gives leaves depth 0 and collapses cycles', () => {
    const { depth, cycles } = computeDepths(edges);
    expect(depth.get('src/leaf.js')).toBe(0);
    expect(depth.get('src/reader.js')).toBe(1);
    expect(depth.get('src/app.ts')).toBe(2);
    expect(depth.get('src/x.ts')).toBe(0);
    expect(cycles).toEqual([['src/x.ts', 'src/y.ts']]);
  });

  it('can restrict depth to window edges', () => {
    const { depth } = computeDepths(edges, (edge) => edge.kind === 'window');
    expect(depth.get('src/app.ts')).toBe(2);
    expect(depth.get('src/x.ts')).toBe(0);
  });

  it('orders bridges leaf first', () => {
    const { depth } = computeDepths(edges);
    expect(orderBridges(globalsByName, depth).map((bridge) => [bridge.name, bridge.depth])).toEqual(
      [
        ['Leaf', 0],
        ['Own', 1]
      ]
    );
    expect(orderBridges(globalsByName, depth)[1].readers).toEqual(['src/app.ts']);
  });
});
