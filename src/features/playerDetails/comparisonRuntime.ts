import { POSITION_FILTERS } from '@/config/scoreConfig';
import { useSettingsStore } from '@/store/useSettingsStore';
import { processor } from '@/data/dataProcessor';

export type ComparisonKind = 'attribute' | 'filter' | 'stat';

export type ComparisonCleanValue = (value: unknown) => null | number | string;

interface FilterDistribution {
  max?: unknown;
  min?: unknown;
}

type FilterDistributionRecord = Record<string, FilterDistribution>;

export interface PlayerDetailsComparisonRuntime {
  cleanValue: ComparisonCleanValue;
  filterDistributionCache: ReadonlyMap<string, FilterDistributionRecord>;
  maxBeeswarmPlayers: number;
  mergedData: readonly Record<string, unknown>[];
  minMins: null | number;
}

interface ComparisonContextDataOptions {
  currentPosition: string;
  kind: ComparisonKind;
  runtime: PlayerDetailsComparisonRuntime;
}

interface CreateComparisonRuntimeOptions {
  cleanValue: ComparisonCleanValue;
  filterDistributionCache?: ReadonlyMap<string, FilterDistributionRecord>;
  maxBeeswarmPlayers?: number;
  mergedData?: readonly Record<string, unknown>[];
  minMins: null | number;
}

function matchesPosition(candidate: Record<string, unknown>, currentPosition: string) {
  if (currentPosition === 'GK') {
    return candidate.Position === 'GK';
  }

  return candidate.Position !== 'GK';
}

export function createPlayerDetailsComparisonRuntime({
  cleanValue,
  filterDistributionCache = new Map(),
  maxBeeswarmPlayers = 500,
  mergedData = [],
  minMins
}: CreateComparisonRuntimeOptions): PlayerDetailsComparisonRuntime {
  return {
    cleanValue,
    filterDistributionCache,
    maxBeeswarmPlayers,
    mergedData,
    minMins
  };
}

export function createPlayerDetailsComparisonRuntimeFromProcessor(
  minMins: null | number
): PlayerDetailsComparisonRuntime {
  return createPlayerDetailsComparisonRuntime({
    cleanValue: (value) => processor.cleanValue(value),
    filterDistributionCache: processor.filterDistributionCache,
    maxBeeswarmPlayers: useSettingsStore.getState().settings.maxBeeswarmPlayers,
    mergedData: processor.mergedData,
    minMins
  });
}

export function getComparisonContextData({
  currentPosition,
  kind,
  runtime
}: ComparisonContextDataOptions): Record<string, unknown>[] {
  return runtime.mergedData.filter((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return false;
    }

    if (!matchesPosition(candidate, currentPosition)) {
      return false;
    }

    if (kind === 'attribute' || runtime.minMins === null) {
      return true;
    }

    const mins = Number(runtime.cleanValue(candidate.Mins) || 0);
    return mins >= runtime.minMins;
  });
}

export function getFilterDistribution(
  runtime: PlayerDetailsComparisonRuntime,
  currentPosition: string,
  filterName: string
) {
  const filterDist = runtime.filterDistributionCache.get(currentPosition) || {};
  return filterDist[filterName] || null;
}

export function getFilterLimitRange(
  currentPosition: string,
  filterName: string
): { max: null | number; min: null | number } {
  const filterLimit = (
    POSITION_FILTERS as Record<string, Record<string, number | { max?: number }>>
  )[currentPosition]?.[filterName];

  if (typeof filterLimit === 'number') {
    return { max: null, min: filterLimit };
  }

  if (
    typeof filterLimit === 'object' &&
    filterLimit !== null &&
    typeof filterLimit.max === 'number'
  ) {
    return { max: filterLimit.max, min: null };
  }

  return { max: null, min: null };
}
