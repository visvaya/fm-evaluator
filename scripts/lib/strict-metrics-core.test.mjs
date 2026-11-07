import { describe, expect, it } from 'vitest';

import { compareSummaries, parseTscOutput, summarize } from './strict-metrics-core.mjs';

const OUTPUT = [
  "src/b.ts(3,5): error TS2345: Argument of type 'x' is not assignable.",
  "  Type 'null' is not assignable to type 'string'.",
  "src\\a.ts(10,1): error TS18047: 'entry' is possibly 'null'.",
  "src/b.ts(7,2): error TS18047: 'row' is possibly 'null'.",
  'Found 3 errors.',
  ''
].join('\r\n');

describe('parseTscOutput', () => {
  it('reads one diagnostic per error line and skips continuation lines', () => {
    expect(parseTscOutput(OUTPUT)).toEqual([
      { file: 'src/b.ts', line: 3, column: 5, code: 'TS2345' },
      { file: 'src/a.ts', line: 10, column: 1, code: 'TS18047' },
      { file: 'src/b.ts', line: 7, column: 2, code: 'TS18047' }
    ]);
  });

  it('returns nothing for clean output', () => {
    expect(parseTscOutput('')).toEqual([]);
  });
});

describe('summarize', () => {
  it('counts totals, codes and files with sorted keys', () => {
    const summary = summarize(parseTscOutput(OUTPUT));
    expect(summary).toEqual({
      total: 3,
      byCode: { TS18047: 2, TS2345: 1 },
      byFile: { 'src/a.ts': 1, 'src/b.ts': 2 }
    });
    expect(Object.keys(summary.byFile)).toEqual(['src/a.ts', 'src/b.ts']);
  });
});

describe('compareSummaries', () => {
  const baseline = {
    total: 3,
    byCode: { TS18047: 2, TS2345: 1 },
    byFile: { 'src/a.ts': 1, 'src/b.ts': 2 }
  };

  it('holds when nothing changed', () => {
    const result = compareSummaries(baseline, baseline);
    expect(result.risen).toEqual([]);
    expect(result.fallen).toEqual([]);
  });

  it('reports a new file and a new code as a rise even when the total holds', () => {
    const current = {
      total: 3,
      byCode: { TS18047: 2, TS7006: 1 },
      byFile: { 'src/a.ts': 1, 'src/b.ts': 1, 'src/c.ts': 1 }
    };
    const { risen, fallen } = compareSummaries(current, baseline);
    expect(risen.map((row) => `${row.group}:${row.key}`)).toEqual(['code:TS7006', 'file:src/c.ts']);
    expect(fallen.map((row) => `${row.group}:${row.key}`)).toEqual([
      'code:TS2345',
      'file:src/b.ts'
    ]);
  });

  it('reports a fix as a fall down to zero', () => {
    const current = { total: 2, byCode: { TS18047: 2 }, byFile: { 'src/a.ts': 1, 'src/b.ts': 1 } };
    const { risen, fallen } = compareSummaries(current, baseline);
    expect(risen).toEqual([]);
    expect(fallen.find((row) => row.key === 'TS2345')).toMatchObject({ value: 0, ceiling: 1 });
    expect(fallen[0]).toMatchObject({ group: 'total', value: 2, ceiling: 3 });
  });

  it('treats a missing baseline as zero everywhere', () => {
    const { risen } = compareSummaries(baseline, null);
    expect(risen).toHaveLength(5);
  });
});
