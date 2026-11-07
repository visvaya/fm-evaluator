// Centralized UI table state store
// Replaces 14 local let/const variables from main.js so both legacy code
// and new TS modules can read/write the same state object.

import type { SortState, VirtualState } from '../ui/types';

export interface TableStore {
  activeFilters: Record<string, any>;
  currentColumns: any[];
  currentPage: number;
  currentSort: SortState;
  filterDirty: boolean;
  filteredDataCache: any[];
  headersDirty: boolean;
  hiddenColumns: string[];
  lastSortedRows: any[];
  pinnedColumns: string[];
  positionFilterMode: 'and' | 'or';
  roleFiltersEnabled: boolean;
  rowsPerPage: number;
  virtualState: VirtualState;
}

export const store: TableStore = {
  activeFilters: {},
  currentColumns: [],
  currentPage: 1,
  currentSort: { col: 'totalScore', dir: 'desc' },
  filterDirty: true,
  filteredDataCache: [],
  headersDirty: true,
  hiddenColumns: [],
  lastSortedRows: [],
  pinnedColumns: [],
  positionFilterMode: 'or',
  roleFiltersEnabled: false,
  rowsPerPage: 10,
  virtualState: { enabled: false, end: 0, start: 0, total: 0 }
};

export function markFiltersDirty(): void {
  store.filterDirty = true;
}

export function markHeadersDirty(): void {
  store.headersDirty = true;
}
