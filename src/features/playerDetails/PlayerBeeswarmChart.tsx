/* eslint-disable fp/no-let, fp/no-mutation */
import { scaleLinear } from '@visx/scale';
import { useMemo } from 'react';

import { SKIPPABLE_STATS, ZERO_SKIPPABLE_STATS } from '@/config/scoreConfig';
import { cn } from '@/lib/utils';

import type { ComparisonCleanValue } from './comparisonRuntime';

type BeeswarmPointType = 'peer' | 'player';

interface BeeswarmInputPoint {
  id: string;
  type: BeeswarmPointType;
  value: number;
}

interface BeeswarmLayoutPoint extends BeeswarmInputPoint {
  x: number;
  y: number;
}

type BeeswarmChartReason =
  'flat_range' | 'non_numeric_player' | 'processor_unavailable' | 'too_few_points';

interface BeeswarmChartModel {
  max: null | number;
  min: null | number;
  player: BeeswarmLayoutPoint | null;
  points: BeeswarmLayoutPoint[];
  reason: BeeswarmChartReason | null;
}

interface BuildBeeswarmChartModelOptions {
  chartHeight?: number;
  chartWidth?: number;
  cleanValue?: ComparisonCleanValue;
  contextData: Record<string, unknown>[];
  maxPlayers?: number;
  playerValue: number | string;
  statName: string;
}

interface PlayerBeeswarmChartProps {
  className?: string;
  cleanValue: ComparisonCleanValue;
  contextData: Record<string, unknown>[];
  height?: number;
  maxPlayers?: number;
  playerValue: number | string;
  statName: string;
}

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 150;
const MARGIN = { bottom: 25, left: 20, right: 20, top: 20 };
const DOT_COLLISION_DISTANCE = 7;
const DOT_RADIUS = 2.5;
const PLAYER_RADIUS = 4.5;

function samplePeers(points: BeeswarmInputPoint[], limit: number) {
  if (points.length <= limit) {
    return points;
  }

  const stride = (points.length - 1) / (limit - 1);
  const sampled = new Set(Array.from({ length: limit }, (_, index) => Math.round(index * stride)));

  return points.filter((_, index) => sampled.has(index));
}

function hasCollision(point: { x: number; y: number }, placed: BeeswarmLayoutPoint[]) {
  return placed.some((candidate) => {
    const deltaX = candidate.x - point.x;
    const deltaY = candidate.y - point.y;
    return Math.hypot(deltaX, deltaY) < DOT_COLLISION_DISTANCE;
  });
}

function getYOffsetCandidates(chartHeight: number) {
  return [
    0,
    ...Array.from({ length: Math.floor(chartHeight / DOT_COLLISION_DISTANCE) }, (_, index) => {
      const step = (index + 1) * DOT_COLLISION_DISTANCE;
      return [step, -step];
    }).flat()
  ];
}

function layoutPoints(
  points: BeeswarmInputPoint[],
  min: number,
  max: number,
  width: number,
  height: number
) {
  const xScale = scaleLinear({
    domain: [min, max],
    range: [MARGIN.left, width - MARGIN.right]
  });
  const centerY = height / 2;
  const yOffsets = getYOffsetCandidates(height);
  const sorted = points.toSorted(
    (left, right) => left.value - right.value || left.id.localeCompare(right.id)
  );
  let placed: BeeswarmLayoutPoint[] = [];

  for (const point of sorted) {
    const x = xScale(point.value);
    const candidate = yOffsets
      .map((offset) => ({
        ...point,
        x,
        y: centerY + offset
      }))
      .find((nextPoint) => !hasCollision(nextPoint, placed)) ?? {
      ...point,
      x,
      y: centerY
    };

    placed = [...placed, candidate];
  }

  return placed;
}

function getFallbackModel(reason: BeeswarmChartReason): BeeswarmChartModel {
  return {
    max: null,
    min: null,
    player: null,
    points: [],
    reason
  };
}

export function buildBeeswarmChartModel({
  chartHeight = DEFAULT_HEIGHT,
  chartWidth = DEFAULT_WIDTH,
  cleanValue,
  contextData,
  maxPlayers = 500,
  playerValue,
  statName
}: BuildBeeswarmChartModelOptions): BeeswarmChartModel {
  if (typeof cleanValue !== 'function') {
    return getFallbackModel('processor_unavailable');
  }

  const playerNumericValue = cleanValue(playerValue);
  if (typeof playerNumericValue !== 'number') {
    return getFallbackModel('non_numeric_player');
  }

  const zeroSkippableStats = new Set<string>([...SKIPPABLE_STATS, ...ZERO_SKIPPABLE_STATS]);
  const peerValues = contextData
    .map((candidate, index) => ({
      id: `peer-${index}`,
      type: 'peer' as const,
      value: cleanValue(candidate[statName])
    }))
    .filter(
      (point): point is { id: string; type: 'peer'; value: number } =>
        typeof point.value === 'number'
    )
    .filter((point) => !zeroSkippableStats.has(statName) || point.value !== 0);

  const allPoints = [
    ...peerValues,
    { id: 'player', type: 'player' as const, value: playerNumericValue }
  ];

  if (allPoints.length < 4) {
    return getFallbackModel('too_few_points');
  }

  const values = allPoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return getFallbackModel('flat_range');
  }

  const sampledPeers = samplePeers(peerValues, Math.max(1, maxPlayers - 1));
  const laidOut = layoutPoints(
    [...sampledPeers, { id: 'player', type: 'player', value: playerNumericValue }],
    min,
    max,
    chartWidth,
    chartHeight
  );

  return {
    max,
    min,
    player: laidOut.find((point) => point.type === 'player') ?? null,
    points: laidOut,
    reason: null
  };
}

function getFallbackText(reason: BeeswarmChartReason) {
  switch (reason) {
    case 'flat_range': {
      return 'Comparison unavailable: the peer values do not vary enough to render a chart.';
    }
    case 'non_numeric_player': {
      return 'Comparison unavailable: this player has no numeric value for the selected metric.';
    }
    case 'processor_unavailable': {
      return 'Comparison unavailable: processor data is not ready yet.';
    }
    case 'too_few_points': {
      return 'Comparison unavailable: not enough peer data to render a meaningful chart.';
    }
    default: {
      return 'Comparison unavailable.';
    }
  }
}

function formatTick(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatPlayerValue(value: number | string) {
  return typeof value === 'number' ? formatTick(value) : value;
}

export function PlayerBeeswarmChart({
  cleanValue,
  className,
  contextData,
  height = DEFAULT_HEIGHT,
  maxPlayers,
  playerValue,
  statName
}: Readonly<PlayerBeeswarmChartProps>) {
  const model = useMemo(
    () =>
      buildBeeswarmChartModel({
        chartHeight: height,
        cleanValue,
        contextData,
        maxPlayers,
        playerValue,
        statName
      }),
    [cleanValue, contextData, height, maxPlayers, playerValue, statName]
  );

  if (model.reason) {
    return (
      <div
        data-testid="player-beeswarm-chart"
        className={cn(
          'flex items-center justify-center rounded-2xl border border-dashed border-border bg-background/60 px-4 py-6 text-center text-xs text-text-secondary',
          className
        )}
      >
        {getFallbackText(model.reason)}
      </div>
    );
  }

  return (
    <div
      data-testid="player-beeswarm-chart"
      className={cn('rounded-2xl border border-border bg-surface/80 p-3', className)}
    >
      <svg
        viewBox={`0 0 ${DEFAULT_WIDTH} ${height}`}
        className="h-full w-full"
        role="img"
        aria-label={`${statName} comparison chart`}
      >
        <line
          x1={MARGIN.left}
          x2={DEFAULT_WIDTH - MARGIN.right}
          y1={height / 2}
          y2={height / 2}
          stroke="currentColor"
          className="text-border"
        />
        {model.points.map((point) => (
          <circle
            key={point.id}
            cx={point.x}
            cy={point.y}
            r={point.type === 'player' ? PLAYER_RADIUS : DOT_RADIUS}
            className={point.type === 'player' ? 'fill-accent' : 'fill-text-muted/60'}
          />
        ))}
        <text x={MARGIN.left} y={height - 6} className="fill-text-muted text-[10px]">
          {formatTick(model.min ?? 0)}
        </text>
        <text
          x={DEFAULT_WIDTH - MARGIN.right}
          y={height - 6}
          textAnchor="end"
          className="fill-text-muted text-[10px]"
        >
          {formatTick(model.max ?? 0)}
        </text>
        <text
          x={DEFAULT_WIDTH / 2}
          y={16}
          textAnchor="middle"
          className="fill-text-primary text-[10px] font-semibold"
        >
          {formatPlayerValue(playerValue)}
        </text>
      </svg>
    </div>
  );
}
