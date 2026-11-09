/* eslint-disable sonarjs/cognitive-complexity -- extracted legacy-compatible data filtering keeps exact behavior while UI filters move to React. */
import { getPlayerLeagueMultiplier } from '@/computing/ldc';
import { collator, VIRTUAL_BATCH } from '@/config/columns';
import { getFilterRuntime } from '@/lib/filterRuntime';
import { store } from '@/store/tableStore';
import { normalizeDiacritics } from '@/utils/helpers';

const STANDARD_POSITIONS = new Set(
  [
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
    'ST (C)'
  ].map((position) => position.toLowerCase())
);

function getAllPlayerPositions(player: any): string[] {
  const allPositions = [...(player.positionArray || []), ...(player.pos2Array || [])];
  const filteredPositions = allPositions.filter(
    (position: string) => position?.trim() && position.trim() !== '-'
  );
  const position = typeof player.position === 'string' ? player.position.trim() : '';
  const hasPosition = position !== '' && position !== '-';

  if (filteredPositions.length === 0 && hasPosition) {
    return [position];
  }

  return filteredPositions;
}

function isOtherUnknownPlayer(player: any): boolean {
  const playerPositions = getAllPlayerPositions(player);
  return (
    playerPositions.length === 0 ||
    !playerPositions
      .map((position) => position.toLowerCase())
      .every((position) => STANDARD_POSITIONS.has(position))
  );
}

function getPositionSet(player: any): Set<string> {
  return new Set(
    [...(player.positionArray || []), ...(player.pos2Array || [])].map((position: string) =>
      position.toLowerCase()
    )
  );
}

function matchesPositionArrayFilter(player: any, filterValue: string[]): boolean {
  const hasOtherUnknownFilter = filterValue.some((tag) => tag.toLowerCase() === 'inna/nieznana');
  const allPositions = getPositionSet(player);

  if (!hasOtherUnknownFilter) {
    return store.positionFilterMode === 'and'
      ? filterValue.every((tag) => allPositions.has(tag.toLowerCase()))
      : filterValue.some((tag) => allPositions.has(tag.toLowerCase()));
  }

  const otherFilters = filterValue.filter((tag) => tag.toLowerCase() !== 'inna/nieznana');
  const otherUnknown = isOtherUnknownPlayer(player);

  if (store.positionFilterMode === 'and') {
    return otherFilters.length === 0
      ? otherUnknown
      : otherUnknown && otherFilters.every((tag) => allPositions.has(tag.toLowerCase()));
  }

  return otherUnknown || otherFilters.some((tag) => allPositions.has(tag.toLowerCase()));
}

function getPositionSearchText(player: any): string {
  const pos2ArrayLower = new Set(
    (player.pos2Array || []).map((position: string) => position.toLowerCase())
  );
  const nominalPositions = (player.positionArray || []).filter(
    (position: string) => !pos2ArrayLower.has(position.toLowerCase())
  );
  const nominalDisplay =
    nominalPositions.length > 0 ? nominalPositions.join(', ') : (player.position ?? '');
  const secondaryDisplay = (player.pos2Array || [])
    .filter((position: string) => position?.trim())
    .join(', ');

  return `${nominalDisplay} ${secondaryDisplay}`.toLowerCase();
}

function matchesPositionStringFilter(player: any, filterValue: string): boolean {
  const searchText = getPositionSearchText(player);
  const searchLower = filterValue.toLowerCase();

  if (searchLower.includes('inna') || searchLower.includes('nieznana')) {
    return isOtherUnknownPlayer(player) || searchText.includes(searchLower);
  }

  return searchText.includes(searchLower);
}

function getValueRangeNumber(
  runtime: ReturnType<typeof getFilterRuntime>,
  value: unknown,
  isWage: boolean
): null | number {
  return runtime.getNumericValue(value, false, isWage);
}

// Bounds the import kept for a money range, read with the units of the export language.
function importedBounds(
  player: Record<string, unknown>,
  isWage: boolean
): null | { high: number; low: number } {
  const field = isWage ? 'basic_wage' : 'basic_transfer_value';
  const low = player[`${field}_low`];
  const high = player[`${field}_high`];
  return typeof low === 'number' && typeof high === 'number' ? { high, low } : null;
}

// A minimum compares the lower bound of a range, a maximum the upper bound.
function boundsMatch(
  bounds: { high: number; low: number },
  filterValue: { max?: number; min?: number }
): boolean {
  const aboveMin = filterValue.min === undefined || bounds.low >= filterValue.min;
  const belowMax = filterValue.max === undefined || bounds.high <= filterValue.max;
  return aboveMin && belowMax;
}

function matchesMoneyRange(
  runtime: ReturnType<typeof getFilterRuntime>,
  value: unknown,
  filterValue: { max?: number; min?: number },
  isWage: boolean
): boolean {
  const valueString = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  if (valueString.includes('-') && /\d/.test(valueString)) {
    const separatorIndex = valueString.indexOf('-');
    if (separatorIndex > 0 && separatorIndex < valueString.length - 1) {
      const leftValue = runtime.parseNumber(valueString.slice(0, separatorIndex).trim());
      const rightValue = runtime.parseNumber(valueString.slice(separatorIndex + 1).trim());
      if (leftValue !== null && rightValue !== null) {
        if (filterValue.min !== undefined && leftValue < filterValue.min) {
          return false;
        }
        if (filterValue.max !== undefined && rightValue > filterValue.max) {
          return false;
        }
        return true;
      }
    }
  }

  const numericValue = getValueRangeNumber(runtime, value, isWage);
  if (filterValue.min !== undefined && numericValue !== null && numericValue < filterValue.min) {
    return false;
  }
  if (filterValue.max !== undefined && numericValue !== null && numericValue > filterValue.max) {
    return false;
  }
  return true;
}

function getBestRoleScore(value: unknown): null | number {
  if (value && typeof value === 'object' && 'score' in value) {
    return Number(value.score);
  }
  if (typeof value === 'string') {
    return Number.parseFloat(/^([\d.]+)/.exec(value)?.[1] || '0');
  }
  return null;
}

function getNumericCleanValue(
  runtime: ReturnType<typeof getFilterRuntime>,
  value: unknown
): null | number {
  const cleanedValue = runtime.cleanValue(value);
  return typeof cleanedValue === 'number' && !Number.isNaN(cleanedValue) ? cleanedValue : null;
}

function matchesRangeFilter(
  runtime: ReturnType<typeof getFilterRuntime>,
  player: any,
  key: string,
  filterValue: { max?: number; min?: number }
): boolean {
  const value = player[key];

  if (key === 'value' || key === 'wage') {
    const bounds = importedBounds(player as Record<string, unknown>, key === 'wage');
    return bounds
      ? boundsMatch(bounds, filterValue)
      : matchesMoneyRange(runtime, value, filterValue, key === 'wage');
  }

  if (key === 'leftFootStars' || key === 'rightFootStars') {
    const numericKey = key === 'leftFootStars' ? 'leftFootValue' : 'rightFootValue';
    const numericValue = player[numericKey] === undefined ? null : player[numericKey];
    if (
      filterValue.min !== undefined &&
      (numericValue === null || numericValue < filterValue.min)
    ) {
      return false;
    }
    if (
      filterValue.max !== undefined &&
      (numericValue === null || numericValue > filterValue.max)
    ) {
      return false;
    }
    return true;
  }

  if (key === 'bestRoleTotal' || key === 'bestRoleStat' || key === 'bestRoleAttr') {
    const score = getBestRoleScore(value);
    if (filterValue.min !== undefined && (score === null || score < filterValue.min)) {
      return false;
    }
    if (filterValue.max !== undefined && (score === null || score > filterValue.max)) {
      return false;
    }
    return true;
  }

  const numericValue = getNumericCleanValue(runtime, value);
  if (filterValue.min !== undefined && (numericValue === null || numericValue < filterValue.min)) {
    return false;
  }
  if (filterValue.max !== undefined && (numericValue === null || numericValue > filterValue.max)) {
    return false;
  }
  return true;
}

function matchesColumnFilter(
  runtime: ReturnType<typeof getFilterRuntime>,
  player: any,
  key: string,
  filterValue: any
): boolean {
  if (key === 'position') {
    if (Array.isArray(filterValue)) {
      return matchesPositionArrayFilter(player, filterValue);
    }
    if (typeof filterValue === 'string') {
      return matchesPositionStringFilter(player, filterValue);
    }
  }

  const value = player[key];
  if (
    typeof filterValue === 'string' &&
    !normalizeDiacritics(String(value).toLowerCase()).includes(normalizeDiacritics(filterValue))
  ) {
    return false;
  }
  if (Array.isArray(filterValue) && !filterValue.includes(value)) {
    return false;
  }
  if (filterValue && typeof filterValue === 'object') {
    return matchesRangeFilter(runtime, player, key, filterValue);
  }
  return true;
}

export function getFilteredData(): any[] {
  if (!store.filterDirty) {
    return store.filteredDataCache;
  }

  const runtime = getFilterRuntime();
  const filterKeys = Object.keys(store.activeFilters);
  const clubHasPossession = store.activeFilters.clubHasPossession === true;
  const ldcFilterEnabled = runtime.settings.ldcFilterEnabled || false;
  const ldcFilterMin = runtime.settings.ldcFilterMin || 0;
  const ldcFilterMax = runtime.settings.ldcFilterMax || 5;
  const minMinsThreshold = runtime.getMinMins();
  const data: any[] = [];

  for (const player of runtime.calculatedScores) {
    if (store.roleFiltersEnabled && !player.passesFilters) {
      continue;
    }

    if (clubHasPossession && player.club) {
      const possession = runtime.getTeamPossession(player.club);
      if (possession === null || possession === undefined) {
        continue;
      }
    }

    if (ldcFilterEnabled) {
      const multiplier = getPlayerLeagueMultiplier(player);
      if (multiplier < ldcFilterMin || multiplier > ldcFilterMax) {
        continue;
      }
    }

    if (minMinsThreshold !== null) {
      const playerMinutes = getNumericCleanValue(runtime, player.mins);
      if (playerMinutes === null || playerMinutes < minMinsThreshold) {
        continue;
      }
    }

    const matches = filterKeys.every((key) => {
      if (key === 'clubHasPossession') {
        return true;
      }
      return matchesColumnFilter(runtime, player, key, store.activeFilters[key]);
    });

    if (matches) {
      data.push(player);
    }
  }

  store.filteredDataCache = data;
  store.filterDirty = false;
  store.virtualState.start = 0;
  store.virtualState.end = Math.min(VIRTUAL_BATCH, data.length);
  return data;
}

function normalizeSortValue(
  runtime: ReturnType<typeof getFilterRuntime>,
  value: unknown,
  columnId: string
): unknown {
  if (columnId === 'bestRoleAttr' || columnId === 'bestRoleStat' || columnId === 'bestRoleTotal') {
    return getBestRoleScore(value);
  }
  if (
    columnId === 'scorePerValue' ||
    columnId === 'scorePerValueAtr' ||
    columnId === 'scorePerValueStat' ||
    columnId === 'scorePerWage' ||
    columnId === 'scorePerWageAtr' ||
    columnId === 'scorePerWageStat'
  ) {
    return value !== null && !Number.isNaN(Number(value)) ? value : null;
  }
  if (columnId === 'value') {
    return runtime.getNumericValue(value, true);
  }
  if (columnId === 'wage') {
    return runtime.getNumericValue(value, false, true);
  }
  return value;
}

export function getSortedData(data: any[]): any[] {
  const runtime = getFilterRuntime();
  if (data.length <= 1) {
    return [...data];
  }

  return data.toSorted((left, right) => {
    const leftValue = normalizeSortValue(
      runtime,
      left[store.currentSort.col],
      store.currentSort.col
    );
    const rightValue = normalizeSortValue(
      runtime,
      right[store.currentSort.col],
      store.currentSort.col
    );

    if (typeof leftValue === 'string' && typeof rightValue === 'string') {
      return store.currentSort.dir === 'asc'
        ? collator.compare(leftValue, rightValue)
        : collator.compare(rightValue, leftValue);
    }

    const leftNumber = (leftValue as null | number | undefined) ?? -Infinity;
    const rightNumber = (rightValue as null | number | undefined) ?? -Infinity;
    return store.currentSort.dir === 'asc' ? leftNumber - rightNumber : rightNumber - leftNumber;
  });
}
