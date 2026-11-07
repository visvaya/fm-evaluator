import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useUiText } from '@/hooks/useUiText';
import { cn } from '@/lib/utils';

import {
  getComparisonContextData,
  getFilterDistribution,
  getFilterLimitRange
} from './comparisonRuntime';
import { PlayerBeeswarmChart } from './PlayerBeeswarmChart';

import type { ComparisonKind, PlayerDetailsComparisonRuntime } from './comparisonRuntime';
import type {
  PlayerMetricBreakdownRow,
  RoleRequirementItem
} from '@/features/playerDetails/models';
import type { Player } from '@/ui/types';

interface PlayerMetricComparisonProps {
  comparisonRuntime: PlayerDetailsComparisonRuntime;
  currentPosition: string;
  item: PlayerMetricBreakdownRow | RoleRequirementItem;
  kind: ComparisonKind;
  player: Player;
}

function hasTruthyMetricFlag(item: PlayerMetricBreakdownRow | RoleRequirementItem, flag: string) {
  return Object.hasOwn(item, flag) && Boolean((item as unknown as Record<string, unknown>)[flag]);
}

function getUnavailableReason(
  item: PlayerMetricBreakdownRow | RoleRequirementItem,
  kind: ComparisonKind
): null | string {
  if (hasTruthyMetricFlag(item, 'skipped')) {
    return 'comparison_unavailable_source_gap';
  }

  if (hasTruthyMetricFlag(item, 'isMissing')) {
    return 'comparison_unavailable_missing';
  }

  if (hasTruthyMetricFlag(item, 'isLow')) {
    return 'comparison_unavailable_low_minutes';
  }

  if (hasTruthyMetricFlag(item, 'isRange') && item.chartValue === null) {
    return 'comparison_unavailable_range';
  }

  if (item.chartValue === null) {
    return kind === 'filter'
      ? 'comparison_unavailable_source_gap'
      : 'comparison_unavailable_missing';
  }

  return null;
}

function FilterRangePreview({
  comparisonRuntime,
  currentPosition,
  item
}: Readonly<{
  comparisonRuntime: PlayerDetailsComparisonRuntime;
  currentPosition: string;
  item: RoleRequirementItem;
}>) {
  const distribution = useMemo(
    () => getFilterDistribution(comparisonRuntime, currentPosition, item.sourceKey),
    [comparisonRuntime, currentPosition, item.sourceKey]
  );

  const markers = useMemo(() => {
    if (!distribution || item.chartValue === null) {
      return null;
    }

    const min = Number(distribution.min);
    const max = Number(distribution.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      return null;
    }

    const { max: filterMax, min: filterMin } = getFilterLimitRange(currentPosition, item.sourceKey);
    const toPercent = (value: number) =>
      Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

    return {
      filterMax,
      filterMaxPercent: filterMax === null ? null : toPercent(filterMax),
      filterMin,
      filterMinPercent: filterMin === null ? null : toPercent(filterMin),
      max,
      min,
      playerPercent: toPercent(item.chartValue)
    };
  }, [currentPosition, distribution, item.chartValue, item.sourceKey]);

  if (!markers) {
    return null;
  }

  return (
    <div className="mt-3 rounded-2xl border border-border/70 bg-surface/60 p-3">
      <div className="relative h-9 rounded-full bg-background/80">
        {markers.filterMinPercent === null ? null : (
          <div
            className="absolute inset-y-1 w-0.5 bg-warning"
            style={{ left: `${markers.filterMinPercent}%` }}
          >
            <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono text-warning">
              min {markers.filterMin}
            </span>
          </div>
        )}
        {markers.filterMaxPercent === null ? null : (
          <div
            className="absolute inset-y-1 w-0.5 bg-warning"
            style={{ left: `${markers.filterMaxPercent}%` }}
          >
            <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono text-warning">
              max {markers.filterMax}
            </span>
          </div>
        )}
        <div
          className="absolute inset-y-0 w-1 rounded-full bg-positive"
          style={{ left: `${markers.playerPercent}%` }}
        >
          <span className="absolute -bottom-5 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono text-positive">
            {item.value}
          </span>
        </div>
      </div>
      <div className="mt-3 flex justify-between text-[10px] font-mono text-text-muted">
        <span>{markers.min.toFixed(2)}</span>
        <span>{markers.max.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function PlayerMetricComparison({
  comparisonRuntime,
  currentPosition,
  item,
  kind,
  player
}: Readonly<PlayerMetricComparisonProps>) {
  const t = useUiText();
  const [expanded, setExpanded] = useState(false);
  const unavailableReason = getUnavailableReason(item, kind);
  const contextData = useMemo(
    () =>
      expanded && unavailableReason === null
        ? getComparisonContextData({
            currentPosition,
            kind,
            runtime: comparisonRuntime
          })
        : [],
    [comparisonRuntime, currentPosition, expanded, kind, unavailableReason]
  );
  const buttonLabel = expanded ? t('hide_comparison') : t('show_comparison');
  const expandedContent = (() => {
    if (!expanded) {
      return null;
    }

    if (unavailableReason) {
      return (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-background/60 px-3 py-3 text-xs text-text-secondary">
          {t(unavailableReason)}
        </div>
      );
    }

    if (contextData.length === 0) {
      return (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-background/60 px-3 py-3 text-xs text-text-secondary">
          {t('comparison_unavailable_empty_context')}
        </div>
      );
    }

    return (
      <div className="mt-3 rounded-2xl border border-border bg-background/70 p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
          {player.name} • {item.label}
        </div>
        <PlayerBeeswarmChart
          cleanValue={comparisonRuntime.cleanValue}
          className={cn('h-[150px]', kind === 'filter' && 'h-[160px]')}
          contextData={contextData}
          height={kind === 'filter' ? 160 : 150}
          maxPlayers={comparisonRuntime.maxBeeswarmPlayers}
          playerValue={item.chartValue}
          statName={item.sourceKey}
        />
      </div>
    );
  })();

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface hover:text-text-primary"
        aria-expanded={expanded}
      >
        <BarChart3 className="h-3.5 w-3.5" />
        <span>{buttonLabel}</span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {kind === 'filter' ? (
        <FilterRangePreview
          comparisonRuntime={comparisonRuntime}
          currentPosition={currentPosition}
          item={item as RoleRequirementItem}
        />
      ) : null}
      {expandedContent}
    </div>
  );
}
