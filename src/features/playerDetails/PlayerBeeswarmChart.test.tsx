import { describe, expect, it, vi } from 'vitest';

vi.mock('@/data/dataProcessor', () => ({
  processor: {
    cleanValue: (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
}));

import { buildBeeswarmChartModel } from './PlayerBeeswarmChart';

const cleanValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

describe('buildBeeswarmChartModel', () => {
  it('builds a deterministic chart model and respects the max player limit', () => {
    const model = buildBeeswarmChartModel({
      cleanValue,
      contextData: [
        { Metric: 1 },
        { Metric: 2 },
        { Metric: 3 },
        { Metric: 4 },
        { Metric: 5 },
        { Metric: 6 }
      ],
      maxPlayers: 5,
      playerValue: 4.5,
      statName: 'Metric'
    });

    expect(model.reason).toBeNull();
    expect(model.points).toHaveLength(5);
    expect(model.player?.value).toBe(4.5);
    expect(model.points.map((point) => [point.id, point.x, point.y])).toMatchInlineSnapshot(`
      [
        [
          "peer-0",
          20,
          75,
        ],
        [
          "peer-2",
          164,
          75,
        ],
        [
          "peer-3",
          236,
          75,
        ],
        [
          "player",
          272,
          75,
        ],
        [
          "peer-5",
          380,
          75,
        ],
      ]
    `);
  });

  it('skips known missing and zero-only stat values before rendering', () => {
    const skippable = buildBeeswarmChartModel({
      cleanValue,
      contextData: [
        { 'NP-Gls-NP-xG/90': '-' },
        { 'NP-Gls-NP-xG/90': 1 },
        { 'NP-Gls-NP-xG/90': 2 },
        { 'NP-Gls-NP-xG/90': 3 },
        { 'NP-Gls-NP-xG/90': 4 }
      ],
      playerValue: 2.5,
      statName: 'NP-Gls-NP-xG/90'
    });

    const zeroSkippable = buildBeeswarmChartModel({
      cleanValue,
      contextData: [
        { 'Dist/90': 0 },
        { 'Dist/90': 10 },
        { 'Dist/90': 20 },
        { 'Dist/90': 30 },
        { 'Dist/90': 40 }
      ],
      playerValue: 25,
      statName: 'Dist/90'
    });

    expect(skippable.reason).toBeNull();
    expect(zeroSkippable.reason).toBeNull();

    expect(skippable.points.some((point) => point.value === 0)).toBe(false);
    expect(skippable.points).toHaveLength(5);
    expect(zeroSkippable.points.some((point) => point.value === 0)).toBe(false);
    expect(zeroSkippable.points).toHaveLength(5);
  });

  it('returns explicit fallback reasons for non-renderable input', () => {
    expect(
      buildBeeswarmChartModel({
        cleanValue,
        contextData: [{ Metric: 1 }, { Metric: 2 }, { Metric: 3 }, { Metric: 4 }],
        playerValue: '-',
        statName: 'Metric'
      }).reason
    ).toBe('non_numeric_player');

    expect(
      buildBeeswarmChartModel({
        cleanValue,
        contextData: [{ Metric: 1 }, { Metric: 2 }],
        playerValue: 3,
        statName: 'Metric'
      }).reason
    ).toBe('too_few_points');

    expect(
      buildBeeswarmChartModel({
        cleanValue,
        contextData: [{ Metric: 2 }, { Metric: 2 }, { Metric: 2 }, { Metric: 2 }],
        playerValue: 2,
        statName: 'Metric'
      }).reason
    ).toBe('flat_range');
  });
});
