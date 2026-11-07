import { loadLeagueMappings } from '@/computing/ldcMappings';
import { normalizeLeagueNameForGrouping } from '@/computing/ldcUtils';

export type FilterMode = 'and' | 'or';

export const STANDARD_POSITION_ORDER = [
  'GK',
  'D (L)',
  'D (C)',
  'D (R)',
  'WB (L)',
  'WB (R)',
  'DM',
  'M (L)',
  'M (C)',
  'M (R)',
  'AM (L)',
  'AM (C)',
  'AM (R)',
  'ST (C)',
  'Inna/nieznana'
];

export function buildSearchFilterValue(value: string): null | string {
  const normalizedValue = value.trim().toLowerCase();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function buildRangeFilterValue(
  min: string,
  max: string
): null | { max?: number; min?: number } {
  if (!min && !max) {
    return null;
  }

  const filter: { max?: number; min?: number } = {};
  if (min) {
    filter.min = Number.parseFloat(min);
  }
  if (max) {
    filter.max = Number.parseFloat(max);
  }
  return filter;
}

export function toggleFilterValue(currentValue: unknown, value: string): string[] {
  const selectedValues = Array.isArray(currentValue)
    ? currentValue.filter((item): item is string => typeof item === 'string')
    : [];
  return selectedValues.includes(value)
    ? selectedValues.filter((item) => item !== value)
    : [...selectedValues, value];
}

export function setSelectedValues(
  currentValue: unknown,
  values: string[],
  selected: boolean
): string[] {
  const currentValues = Array.isArray(currentValue)
    ? currentValue.filter((item): item is string => typeof item === 'string')
    : [];
  const selectedSet = new Set(currentValues);

  values.forEach((value) => {
    if (selected) {
      selectedSet.add(value);
    } else {
      selectedSet.delete(value);
    }
  });

  return [...selectedSet];
}

export function sortPositionsIntelligently(positions: string[]): string[] {
  const orderMap = new Map<string, number>();
  STANDARD_POSITION_ORDER.forEach((position, index) => {
    orderMap.set(position, index);
  });

  return positions.toSorted((left, right) => {
    const leftOrder = orderMap.has(left) ? orderMap.get(left) : Infinity;
    const rightOrder = orderMap.has(right) ? orderMap.get(right) : Infinity;

    if (leftOrder !== Infinity && rightOrder !== Infinity) {
      return leftOrder - rightOrder;
    }
    if (leftOrder !== Infinity) {
      return -1;
    }
    if (rightOrder !== Infinity) {
      return 1;
    }
    return left.localeCompare(right);
  });
}

export function isLdcMatchedLeague(
  leagueName: string,
  ldcSettings: null | undefined | { leagues?: { name: string }[] }
): boolean {
  const ldcLeagueNames = new Set<string>();
  ldcSettings?.leagues?.forEach((league) => {
    ldcLeagueNames.add(league.name);
    const normalized = normalizeLeagueNameForGrouping(league.name);
    if (normalized !== league.name) {
      ldcLeagueNames.add(normalized);
    }
  });

  const mappings = loadLeagueMappings();
  const normalizedLeagueName = normalizeLeagueNameForGrouping(leagueName);

  return (
    ldcLeagueNames.has(leagueName) ||
    ldcLeagueNames.has(normalizedLeagueName) ||
    mappings[leagueName] !== undefined ||
    mappings[normalizedLeagueName] !== undefined
  );
}
