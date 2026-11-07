import { beforeEach, describe, expect, it } from 'vitest';

import { markFiltersDirty, markHeadersDirty, store } from './tableStore';

describe('tableStore', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    store.currentPage = 1;
    store.rowsPerPage = 10;
    store.activeFilters = {};
    store.hiddenColumns = [];
    store.currentSort = { col: 'totalScore', dir: 'desc' };
    store.roleFiltersEnabled = false;
    store.pinnedColumns = [];
    store.positionFilterMode = 'or';
    store.filteredDataCache = [];
    store.filterDirty = true;
    store.headersDirty = true;
    store.currentColumns = [];
    store.lastSortedRows = [];
    store.virtualState = { enabled: false, end: 0, start: 0, total: 0 };
  });

  describe('store defaults', () => {
    it('should have correct initial currentPage', () => {
      expect(store.currentPage).toBe(1);
    });

    it('should have correct initial rowsPerPage', () => {
      expect(store.rowsPerPage).toBe(10);
    });

    it('should have empty activeFilters', () => {
      expect(store.activeFilters).toEqual({});
    });

    it('should have empty hiddenColumns', () => {
      expect(store.hiddenColumns).toEqual([]);
    });

    it('should have default sort by totalScore desc', () => {
      expect(store.currentSort).toEqual({ col: 'totalScore', dir: 'desc' });
    });

    it('should have roleFiltersEnabled false', () => {
      expect(store.roleFiltersEnabled).toBe(false);
    });

    it('should have empty pinnedColumns', () => {
      expect(store.pinnedColumns).toEqual([]);
    });

    it('should have positionFilterMode "or"', () => {
      expect(store.positionFilterMode).toBe('or');
    });

    it('should have virtualState disabled', () => {
      expect(store.virtualState).toEqual({ enabled: false, end: 0, start: 0, total: 0 });
    });

    it('should start with filterDirty true', () => {
      expect(store.filterDirty).toBe(true);
    });

    it('should start with headersDirty true', () => {
      expect(store.headersDirty).toBe(true);
    });
  });

  describe('store mutability', () => {
    it('should allow setting currentPage', () => {
      store.currentPage = 5;
      expect(store.currentPage).toBe(5);
    });

    it('should allow setting activeFilters', () => {
      store.activeFilters = { name: { value: 'test' } };
      expect(store.activeFilters).toEqual({ name: { value: 'test' } });
    });

    it('should allow pushing to pinnedColumns', () => {
      store.pinnedColumns.push('name');
      expect(store.pinnedColumns).toContain('name');
    });

    it('should allow toggling sort direction', () => {
      store.currentSort = { col: 'name', dir: 'asc' };
      expect(store.currentSort.dir).toBe('asc');
    });

    it('should allow updating virtualState', () => {
      store.virtualState.enabled = true;
      store.virtualState.start = 10;
      store.virtualState.end = 60;
      store.virtualState.total = 500;
      expect(store.virtualState).toEqual({ enabled: true, end: 60, start: 10, total: 500 });
    });

    it('should allow setting positionFilterMode to "and"', () => {
      store.positionFilterMode = 'and';
      expect(store.positionFilterMode).toBe('and');
    });
  });

  describe('markFiltersDirty', () => {
    it('should set filterDirty to true', () => {
      store.filterDirty = false;
      markFiltersDirty();
      expect(store.filterDirty).toBe(true);
    });

    it('should be idempotent', () => {
      store.filterDirty = true;
      markFiltersDirty();
      expect(store.filterDirty).toBe(true);
    });
  });

  describe('markHeadersDirty', () => {
    it('should set headersDirty to true', () => {
      store.headersDirty = false;
      markHeadersDirty();
      expect(store.headersDirty).toBe(true);
    });

    it('should be idempotent', () => {
      store.headersDirty = true;
      markHeadersDirty();
      expect(store.headersDirty).toBe(true);
    });
  });

  describe('store is a singleton reference', () => {
    it('should be the same object across imports', () => {
      const ref1 = store;
      ref1.currentPage = 99;
      expect(store.currentPage).toBe(99);
    });

    it('should share virtualState by reference', () => {
      const vs = store.virtualState;
      vs.start = 42;
      expect(store.virtualState.start).toBe(42);
    });
  });
});
