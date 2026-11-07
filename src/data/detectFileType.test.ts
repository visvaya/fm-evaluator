import { describe, expect, it } from 'vitest';

import { detectFileType } from './detectFileType';

function makeRegistry(ids: string[], types: Record<string, { category: string; type: string }>) {
  return {
    getAllIds: () => ids,
    get: (id: string) => types[id] ?? null
  };
}

const ATTR_REGISTRY = makeRegistry(
  ['basic_name', 'attribute_pace', 'attribute_acceleration', 'statistic_goals'],
  {
    basic_name: { type: 'text', category: 'basic' },
    attribute_pace: { type: 'attribute', category: 'player' },
    attribute_acceleration: { type: 'attribute', category: 'player' },
    statistic_goals: { type: 'statistic', category: 'player' }
  }
);

describe('detectFileType', () => {
  // ── empty / null input ────────────────────────────────────────────────────

  it('returns unknown for null columnMap', () => {
    const result = detectFileType(null as any, ATTR_REGISTRY);
    expect(result.type).toBe('unknown');
    expect(result.totalCount).toBe(0);
  });

  it('returns unknown for empty columnMap', () => {
    const result = detectFileType({}, ATTR_REGISTRY);
    expect(result.type).toBe('unknown');
  });

  // ── basic-only ────────────────────────────────────────────────────────────

  it('returns unknown when only basic columns are mapped', () => {
    const result = detectFileType({ 0: 'basic_name' }, ATTR_REGISTRY);
    expect(result.type).toBe('unknown');
  });

  // ── attribute-only ────────────────────────────────────────────────────────

  it('returns attr when only attributes (+ basic) are mapped', () => {
    const result = detectFileType(
      { 0: 'basic_name', 1: 'attribute_pace', 2: 'attribute_acceleration' },
      ATTR_REGISTRY
    );
    expect(result.type).toBe('attr');
    expect(result.attributeCount).toBe(2);
    expect(result.statisticCount).toBe(0);
  });

  // ── statistics-only ───────────────────────────────────────────────────────

  it('returns stats when only statistics (+ basic) are mapped', () => {
    const result = detectFileType({ 0: 'basic_name', 1: 'statistic_goals' }, ATTR_REGISTRY);
    expect(result.type).toBe('stats');
    expect(result.statisticCount).toBe(1);
    expect(result.attributeCount).toBe(0);
  });

  // ── complete ──────────────────────────────────────────────────────────────

  it('returns complete when all schema ids are mapped', () => {
    const result = detectFileType(
      {
        0: 'basic_name',
        1: 'attribute_pace',
        2: 'attribute_acceleration',
        3: 'statistic_goals'
      },
      ATTR_REGISTRY
    );
    expect(result.type).toBe('complete');
  });

  // ── mixed / both ─────────────────────────────────────────────────────────

  it('returns both when ≥30% attributes and ≥30% statistics', () => {
    // Registry has extra unmapped IDs so allMapped=false, preventing 'complete'
    const mixed = makeRegistry(['a1', 'a2', 'a3', 's1', 's2', 's3', 'extra1', 'extra2'], {
      a1: { type: 'attribute', category: 'player' },
      a2: { type: 'attribute', category: 'player' },
      a3: { type: 'attribute', category: 'player' },
      s1: { type: 'statistic', category: 'player' },
      s2: { type: 'statistic', category: 'player' },
      s3: { type: 'statistic', category: 'player' },
      extra1: { type: 'attribute', category: 'player' },
      extra2: { type: 'statistic', category: 'player' }
    });
    const result = detectFileType({ 0: 'a1', 1: 'a2', 2: 'a3', 3: 's1', 4: 's2', 5: 's3' }, mixed);
    expect(result.type).toBe('both');
  });

  // ── threshold boundaries for attr ────────────────────────────────────────

  it('returns attr when ≥70% attributes and <30% statistics', () => {
    // 7 attrs, 2 stats = 77.7% / 22.2%; registry has extra unmapped IDs to prevent 'complete'
    const mappedIds = [...[...Array.from({ length: 7 }).keys()].map((i) => `a${i}`), 's0', 's1'];
    const allIds = [...mappedIds, 'extra_unmapped'];
    const types: Record<string, any> = {};
    for (let i = 0; i < 7; i++) types[`a${i}`] = { type: 'attribute', category: 'player' };
    types.s0 = { type: 'statistic', category: 'player' };
    types.s1 = { type: 'statistic', category: 'player' };
    types.extra_unmapped = { type: 'attribute', category: 'player' };
    const reg = makeRegistry(allIds, types);
    const col: Record<string, any> = {};
    mappedIds.forEach((id, i) => {
      col[i] = id;
    });
    const result = detectFileType(col, reg);
    expect(result.type).toBe('attr');
  });

  // ── counts ────────────────────────────────────────────────────────────────

  it('reports correct totalCount', () => {
    const result = detectFileType({ 0: 'attribute_pace', 1: 'statistic_goals' }, ATTR_REGISTRY);
    expect(result.totalCount).toBe(2);
  });

  it('ignores null / undefined entries in columnMap', () => {
    const result = detectFileType({ 0: null, 1: undefined, 2: 'attribute_pace' }, ATTR_REGISTRY);
    expect(result.totalCount).toBe(1);
    expect(result.type).toBe('attr');
  });

  it('ignores unknown schema ids (not in registry)', () => {
    const result = detectFileType({ 0: 'unknown_column' }, ATTR_REGISTRY);
    expect(result.totalCount).toBe(0);
    expect(result.type).toBe('unknown');
  });
});
