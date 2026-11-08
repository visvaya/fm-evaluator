/* eslint-disable fp/no-delete, fp/no-mutation -- this store is the React-to-legacy seam and must mirror mutable legacy table state. */
import { create } from 'zustand';

import {
  DEFAULT_IMPORT_STATUS,
  syncImportStatusDom,
  type ImportStatusState
} from '@/lib/importStatusDom';
import {
  buildRangeFilterValue,
  buildSearchFilterValue,
  toggleFilterValue,
  type FilterMode
} from '@/ui/filterModel';

import { persistUIState } from '../lib/uiBridge';

import { markFiltersDirty, markHeadersDirty, store as legacyTableStore } from './tableStore';

import type { EngineId, MergeMode } from '@/config/engines';
import type { PlayerDetailsComparisonRuntime } from '@/features/playerDetails/comparisonRuntime';
import type { FilterValue, Player, SortState } from '@/ui/types';

interface BootstrapState {
  error: null | string;
  ready: boolean;
}

interface TableState {
  activeFilters: Record<string, FilterValue>;
  analysisReady: boolean;
  applyColumnFilter: (
    id: string,
    type: string,
    value: { max?: string; min?: string; search?: string }
  ) => void;
  bootstrap: BootstrapState;
  bumpCompatRevision: () => void;
  clearFilters: () => void;
  clearImportStatus: () => void;
  comparisonRuntime: null | PlayerDetailsComparisonRuntime;
  compatRevision: number;
  currentEngine: EngineId;
  currentPage: number;
  currentPosition: string;
  currentSort: SortState;
  data: Player[];
  filteredData: Player[];
  importStatus: ImportStatusState;
  isAnalyzing: boolean;
  mergeMode: MergeMode;
  resetColumnFilter: (id: string) => void;
  rowsPerPage: number;
  searchQuery: string;
  selectedPlayerId: null | string;
  setAnalysisReady: (analysisReady: boolean) => void;
  setAnalyzing: (isAnalyzing: boolean) => void;
  setBootstrapState: (bootstrap: Partial<BootstrapState>) => void;
  setComparisonRuntime: (comparisonRuntime: null | PlayerDetailsComparisonRuntime) => void;
  setCurrentPage: (currentPage: number) => void;
  setData: (data: Player[]) => void;
  setEngine: (currentEngine: EngineId) => void;
  setFilter: (id: string, value: FilterValue) => void;
  setFilteredData: (filteredData: Player[]) => void;
  setImportStatus: (importStatus: ImportStatusState) => void;
  setMergeMode: (mergeMode: MergeMode) => void;
  setPosition: (currentPosition: string) => void;
  setPositionFilterMode: (mode: FilterMode) => void;
  setRowsPerPage: (rowsPerPage: number) => void;
  setSearchQuery: (searchQuery: string) => void;
  setSelectedPlayerId: (selectedPlayerId: null | string) => void;
  setSort: (currentSort: SortState) => void;
  toggleColumnFilterValue: (id: string, value: string) => void;
}

function persistLegacyPagination(currentPage: number) {
  legacyTableStore.currentPage = currentPage;
  persistUIState();
}

function persistLegacyRowsPerPage(rowsPerPage: number) {
  legacyTableStore.rowsPerPage = rowsPerPage;
  legacyTableStore.currentPage = 1;
  persistUIState();
}

function persistLegacySort(currentSort: SortState) {
  legacyTableStore.currentSort = currentSort;
  legacyTableStore.currentPage = 1;
  markHeadersDirty();
  persistUIState();
}

function clearLegacyFilters() {
  legacyTableStore.activeFilters = {};
  legacyTableStore.currentPage = 1;
  markFiltersDirty();
  persistUIState();
}

function commitLegacyFilterState(activeFilters: Record<string, FilterValue>) {
  legacyTableStore.activeFilters = activeFilters;
  legacyTableStore.currentPage = 1;
  markFiltersDirty();
  markHeadersDirty();
  persistUIState();
}

export const useTableStore = create<TableState>((set) => ({
  activeFilters: {},
  analysisReady: false,
  applyColumnFilter: (id, type, value) =>
    set((state) => {
      const nextFilters = { ...legacyTableStore.activeFilters };
      const nextValue =
        type === 'range'
          ? buildRangeFilterValue(value.min ?? '', value.max ?? '')
          : buildSearchFilterValue(value.search ?? '');

      if (nextValue === null) {
        delete nextFilters[id];
      } else {
        nextFilters[id] = nextValue;
      }

      commitLegacyFilterState(nextFilters);
      return {
        activeFilters: nextFilters,
        compatRevision: state.compatRevision + 1,
        currentPage: 1
      };
    }),
  bootstrap: {
    error: null,
    ready: false
  },
  bumpCompatRevision: () =>
    set((state) => ({
      compatRevision: state.compatRevision + 1,
      currentPage: legacyTableStore.currentPage,
      rowsPerPage: legacyTableStore.rowsPerPage,
      currentSort: { ...legacyTableStore.currentSort }
    })),
  clearFilters: () => {
    clearLegacyFilters();
    set((state) => ({
      activeFilters: {},
      compatRevision: state.compatRevision + 1,
      currentPage: 1,
      currentSort: { ...legacyTableStore.currentSort },
      searchQuery: ''
    }));
  },
  clearImportStatus: () => {
    syncImportStatusDom(DEFAULT_IMPORT_STATUS);
    set({ importStatus: DEFAULT_IMPORT_STATUS });
  },
  compatRevision: 0,
  comparisonRuntime: null,
  currentEngine: 'Default',
  currentPage: 1,
  currentPosition: '',
  currentSort: { col: 'totalScore', dir: 'desc' },
  data: [],
  filteredData: [],
  importStatus: DEFAULT_IMPORT_STATUS,
  isAnalyzing: false,
  mergeMode: 'merge',
  rowsPerPage: 50,
  searchQuery: '',
  selectedPlayerId: null,
  resetColumnFilter: (id) =>
    set((state) => {
      const nextFilters = { ...legacyTableStore.activeFilters };
      delete nextFilters[id];
      commitLegacyFilterState(nextFilters);
      return {
        activeFilters: nextFilters,
        compatRevision: state.compatRevision + 1,
        currentPage: 1
      };
    }),
  setAnalysisReady: (analysisReady) => set({ analysisReady }),
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setBootstrapState: (bootstrap) =>
    set((state) => ({
      bootstrap: {
        ...state.bootstrap,
        ...bootstrap
      }
    })),
  setComparisonRuntime: (comparisonRuntime) => set({ comparisonRuntime }),
  setCurrentPage: (currentPage) => {
    persistLegacyPagination(currentPage);
    set({ currentPage });
  },
  setData: (data) => set({ data, filteredData: data }),
  setEngine: (currentEngine) => set({ currentEngine }),
  setFilter: (id, value) =>
    set((state) => ({
      activeFilters: { ...state.activeFilters, [id]: value }
    })),
  setPositionFilterMode: (mode) =>
    set((state) => {
      legacyTableStore.positionFilterMode = mode;
      persistUIState();
      return { compatRevision: state.compatRevision + 1 };
    }),
  setFilteredData: (filteredData) => set({ filteredData }),
  setImportStatus: (importStatus) => {
    syncImportStatusDom(importStatus);
    set({ importStatus });
  },
  setMergeMode: (mergeMode) => set({ mergeMode }),
  setPosition: (currentPosition) => set({ currentPosition }),
  setRowsPerPage: (rowsPerPage) => {
    persistLegacyRowsPerPage(rowsPerPage);
    set({ currentPage: 1, rowsPerPage });
  },
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedPlayerId: (selectedPlayerId) => set({ selectedPlayerId }),
  setSort: (currentSort) => {
    persistLegacySort(currentSort);
    set((state) => ({
      compatRevision: state.compatRevision + 1,
      currentSort
    }));
  },
  toggleColumnFilterValue: (id, value) =>
    set((state) => {
      const nextValues = toggleFilterValue(legacyTableStore.activeFilters[id], value);
      const nextFilters = { ...legacyTableStore.activeFilters };
      if (nextValues.length === 0) {
        delete nextFilters[id];
      } else {
        nextFilters[id] = nextValues;
      }
      legacyTableStore.activeFilters = nextFilters;
      markFiltersDirty();
      return {
        activeFilters: nextFilters,
        compatRevision: state.compatRevision + 1
      };
    })
}));
