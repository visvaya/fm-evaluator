// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyLegacyUIState } from './stateSync';
import { store } from './store/tableStore';
import { useTableStore } from './store/useTableStore';

describe('stateSync', () => {
  beforeEach(() => {
    // Reset store
    store.activeFilters = {};
    store.hiddenColumns = [];
    store.pinnedColumns = [];
    store.roleFiltersEnabled = false;
    store.rowsPerPage = 10;
    store.currentSort = { col: 'totalScore', dir: 'desc' };
    store.positionFilterMode = 'or';
    store.filterDirty = false;
    store.headersDirty = false;
    useTableStore.setState({
      compatRevision: 0,
      currentSort: { col: 'totalScore', dir: 'desc' }
    });

    // Mock window
    vi.stubGlobal('COLUMNS', []);
    vi.stubGlobal('processor', {});
  });

  describe('applyLegacyUIState', () => {
    it('should do nothing for null state', () => {
      applyLegacyUIState(null);
      expect(store.activeFilters).toEqual({});
    });

    it('should do nothing for non-object state', () => {
      applyLegacyUIState('invalid');
      expect(store.activeFilters).toEqual({});
    });

    it('should apply activeFilters', () => {
      applyLegacyUIState({ activeFilters: { name: { value: 'test' } } });
      expect(store.activeFilters).toEqual({ name: { value: 'test' } });
    });

    it('should apply hiddenColumns', () => {
      applyLegacyUIState({ hiddenColumns: ['age', 'wage'] });
      expect(store.hiddenColumns).toEqual(['age', 'wage']);
    });

    it('should apply pinnedColumns', () => {
      applyLegacyUIState({ pinnedColumns: ['name'] });
      expect(store.pinnedColumns).toEqual(['name']);
    });

    it('should apply roleFiltersEnabled', () => {
      applyLegacyUIState({ roleFiltersEnabled: true });
      expect(store.roleFiltersEnabled).toBe(true);
    });

    it('should apply rowsPerPage', () => {
      applyLegacyUIState({ rowsPerPage: 25 });
      expect(store.rowsPerPage).toBe(25);
    });

    it('should fallback to existing rowsPerPage when not provided', () => {
      store.rowsPerPage = 50;
      applyLegacyUIState({});
      expect(store.rowsPerPage).toBe(50);
    });

    it('should apply currentSort', () => {
      applyLegacyUIState({ currentSort: { col: 'name', dir: 'asc' } });
      expect(store.currentSort).toEqual({ col: 'name', dir: 'asc' });
    });

    it('should apply positionFilterMode', () => {
      applyLegacyUIState({ positionFilterMode: 'and' });
      expect(store.positionFilterMode).toBe('and');
    });

    it('should default positionFilterMode to "or" when not provided', () => {
      applyLegacyUIState({});
      expect(store.positionFilterMode).toBe('or');
    });

    it('should default activeFilters to {} when not provided', () => {
      applyLegacyUIState({});
      expect(store.activeFilters).toEqual({});
    });

    it('should mark filters dirty after applying state', () => {
      store.filterDirty = false;
      applyLegacyUIState({ activeFilters: { x: 1 } });
      expect(store.filterDirty).toBe(true);
    });

    it('should mark headers dirty after applying state', () => {
      store.headersDirty = false;
      applyLegacyUIState({ pinnedColumns: ['name'] });
      expect(store.headersDirty).toBe(true);
    });

    it('should apply column widths when COLUMNS available', () => {
      const columns = [
        { id: 'name', savedWidth: undefined },
        { id: 'club', savedWidth: undefined }
      ];
      vi.stubGlobal('COLUMNS', columns);

      applyLegacyUIState({ columnWidths: { club: 200, name: 300 } });

      expect(columns[0].savedWidth).toBe(300);
      expect(columns[1].savedWidth).toBe(200);
    });

    it('should reorder columns when columnOrder provided', () => {
      const columns = [{ id: 'name' }, { id: 'club' }, { id: 'league' }];
      vi.stubGlobal('COLUMNS', columns);

      applyLegacyUIState({ columnOrder: ['league', 'club', 'name'] });

      expect(columns[0].id).toBe('league');
      expect(columns[1].id).toBe('club');
      expect(columns[2].id).toBe('name');
    });

    it('should restore possessionMap when processor exists', () => {
      const processor = { teamPossessionMap: new Map() };
      vi.stubGlobal('processor', processor);

      const possMap = [
        ['TeamA', 60],
        ['TeamB', 40]
      ];
      applyLegacyUIState({ possessionMap: possMap });

      expect(processor.teamPossessionMap).toBeInstanceOf(Map);
      expect(processor.teamPossessionMap.get('TeamA')).toBe(60);
    });

    it('should request a React table sync after applying state', () => {
      applyLegacyUIState({ activeFilters: {} });

      expect(useTableStore.getState().compatRevision).toBe(1);
      expect(useTableStore.getState().currentSort).toEqual(store.currentSort);
    });

    it('should apply all fields in a single call', () => {
      const state = {
        activeFilters: { pos: { values: ['MC'] } },
        currentSort: { col: 'statScore', dir: 'asc' },
        hiddenColumns: ['wage'],
        pinnedColumns: ['name', 'club'],
        positionFilterMode: 'and' as const,
        roleFiltersEnabled: true,
        rowsPerPage: 100
      };

      applyLegacyUIState(state);

      expect(store.activeFilters).toEqual({ pos: { values: ['MC'] } });
      expect(store.hiddenColumns).toEqual(['wage']);
      expect(store.pinnedColumns).toEqual(['name', 'club']);
      expect(store.roleFiltersEnabled).toBe(true);
      expect(store.rowsPerPage).toBe(100);
      expect(store.currentSort).toEqual({ col: 'statScore', dir: 'asc' });
      expect(store.positionFilterMode).toBe('and');
    });
  });
});
