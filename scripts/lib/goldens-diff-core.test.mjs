import { describe, expect, it } from 'vitest';

import { diffSnapshots, formatDiff, parseSnapshot } from './goldens-diff-core.mjs';

describe('parseSnapshot', () => {
  it('parses a JSON document', () => {
    expect(parseSnapshot('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses JSON lines into an array', () => {
    expect(parseSnapshot('{"a":1}\n{"a":2}\n')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('returns undefined for an absent file', () => {
    expect(parseSnapshot(undefined)).toBeUndefined();
  });
});

describe('diffSnapshots', () => {
  it('groups changed leaves by path with collapsed indices', () => {
    const before = {
      rows: [
        { score: 1, name: 'a' },
        { score: 2, name: 'b' }
      ]
    };
    const after = {
      rows: [
        { score: 1.5, name: 'a' },
        { score: 3, name: 'b' }
      ]
    };
    expect(diffSnapshots(before, after)).toEqual([
      { path: 'rows[].score', count: 2, example: { path: 'rows[0].score', before: 1, after: 1.5 } }
    ]);
  });

  it('reports added and removed leaves', () => {
    const groups = diffSnapshots({ a: 1 }, { b: 2 });
    expect(groups.map((g) => g.path)).toEqual(['a', 'b']);
    expect(groups[0].example).toEqual({ path: 'a', before: 1, after: undefined });
    expect(groups[1].example).toEqual({ path: 'b', before: undefined, after: 2 });
  });

  it('returns nothing for equal input', () => {
    expect(diffSnapshots([{ x: [1, 2] }], [{ x: [1, 2] }])).toEqual([]);
  });

  it('treats a type change as a leaf change', () => {
    expect(diffSnapshots({ a: { b: 1 } }, { a: null })).toEqual([
      { path: 'a', count: 1, example: { path: 'a', before: { b: 1 }, after: null } }
    ]);
  });
});

describe('formatDiff', () => {
  it('prints one line per group under the file name', () => {
    const text = formatDiff('x.json', [
      { path: 'a[].b', count: 3, example: { path: 'a[0].b', before: 1, after: 2 } }
    ]);
    expect(text).toBe('x.json\n  a[].b  x3  e.g. a[0].b: 1 -> 2');
  });

  it('says when a file has no leaf changes', () => {
    expect(formatDiff('x.json', [])).toBe('x.json\n  (no leaf changes)');
  });
});
