import { store as legacyTableStore } from '@/store/tableStore';
import { useTableStore } from '@/store/useTableStore';
import { getFilteredData, getSortedData } from '@/ui/filterData';

import type { Player, SortState } from '@/ui/types';

function hasAnalyzedRows(): boolean {
  return useTableStore.getState().analysisReady;
}

function applyGlobalSearch(rows: Player[], searchQuery: string): Player[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return rows;
  }

  return rows.filter((player) => {
    const name = player.name?.toString().toLowerCase() ?? '';
    const club = player.club?.toString().toLowerCase() ?? '';
    const league = player.league?.toString().toLowerCase() ?? '';

    return (
      name.includes(normalizedQuery) ||
      club.includes(normalizedQuery) ||
      league.includes(normalizedQuery)
    );
  });
}

function sortFallbackRows(rows: Player[], sortState: SortState): Player[] {
  if (rows.length <= 1) {
    return [...rows];
  }

  return [...rows].toSorted((left, right) => {
    const leftValue = left[sortState.col as keyof Player];
    const rightValue = right[sortState.col as keyof Player];

    if (typeof leftValue === 'string' && typeof rightValue === 'string') {
      const comparison = leftValue.localeCompare(rightValue);
      return sortState.dir === 'asc' ? comparison : -comparison;
    }

    const leftNumber = Number(leftValue) || 0;
    const rightNumber = Number(rightValue) || 0;
    return sortState.dir === 'asc' ? leftNumber - rightNumber : rightNumber - leftNumber;
  });
}

function matchesStringFilter(rowValue: unknown, filterValue: string): boolean {
  const normalizedFilter = filterValue.trim().toLowerCase();
  if (!normalizedFilter) {
    return true;
  }

  const rawValue =
    typeof rowValue === 'string' || typeof rowValue === 'number' || typeof rowValue === 'boolean'
      ? String(rowValue)
      : '';
  const normalizedValue = rawValue.toLowerCase().trim();
  return normalizedValue.includes(normalizedFilter);
}

function matchesArrayFilter(rowValue: unknown, filterValue: unknown[]): boolean {
  return filterValue.some((value) => Object.is(value, rowValue));
}

function matchesRangeFilter(
  rowValue: unknown,
  filterValue: {
    max?: number;
    min?: number;
  }
): boolean {
  const numericValue = Number(rowValue);
  if (!Number.isFinite(numericValue)) {
    return false;
  }

  if (typeof filterValue.min === 'number' && numericValue < filterValue.min) {
    return false;
  }
  if (typeof filterValue.max === 'number' && numericValue > filterValue.max) {
    return false;
  }

  return true;
}

function matchesFilterValue(rowValue: unknown, filterValue: unknown): boolean {
  if (typeof filterValue === 'string') {
    return matchesStringFilter(rowValue, filterValue);
  }

  if (Array.isArray(filterValue)) {
    return matchesArrayFilter(rowValue, filterValue);
  }

  if (filterValue && typeof filterValue === 'object') {
    return matchesRangeFilter(rowValue, filterValue);
  }

  return true;
}

function applyCompatColumnFilters(rows: Player[]): Player[] {
  const activeFilters = legacyTableStore.activeFilters;
  if (Object.keys(activeFilters).length === 0) {
    return rows;
  }

  return rows.filter((player) => {
    for (const [columnId, filterValue] of Object.entries(activeFilters)) {
      const rowValue = player[columnId];
      if (!matchesFilterValue(rowValue, filterValue)) {
        return false;
      }
    }

    return true;
  });
}

export function getReactTableRows(sourceRows: Player[], searchQuery: string): Player[] {
  const filteredRows = hasAnalyzedRows()
    ? (getFilteredData() as Player[])
    : applyCompatColumnFilters(sourceRows);
  const searchedRows = applyGlobalSearch(filteredRows, searchQuery);

  return hasAnalyzedRows()
    ? (getSortedData(searchedRows) as Player[])
    : sortFallbackRows(searchedRows, legacyTableStore.currentSort);
}

export function requestTableSync(): void {
  useTableStore.getState().bumpCompatRevision();
}
