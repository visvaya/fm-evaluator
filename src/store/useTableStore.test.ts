// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { store as legacyTableStore } from './tableStore';
import { useTableStore } from './useTableStore';

function renderCompatStatusShell() {
  document.body.innerHTML = `
    <div id="upload-status-text" class="hidden">
      <div class="upload-status-content"></div>
    </div>
    <div id="error-log" class="hidden">
      <div class="error-log-content"></div>
    </div>
    <div id="retry-error-container" class="hidden"></div>
    <div id="loading-overlay" style="display:none"></div>
  `;
}

describe('useTableStore', () => {
  beforeEach(() => {
    renderCompatStatusShell();
    legacyTableStore.activeFilters = {};
    legacyTableStore.currentPage = 1;
    legacyTableStore.filterDirty = false;
    legacyTableStore.headersDirty = false;
    legacyTableStore.positionFilterMode = 'or';
    useTableStore.setState({
      activeFilters: {},
      analysisReady: false,
      bootstrap: { error: null, ready: false },
      compatRevision: 0,
      comparisonRuntime: null,
      currentEngine: 'Default',
      currentPage: 1,
      currentPosition: '',
      currentSort: { col: 'totalScore', dir: 'desc' },
      data: [],
      filteredData: [],
      importStatus: {
        canRetry: false,
        details: [],
        kind: 'idle',
        message: ''
      },
      isAnalyzing: false,
      mergeMode: 'merge',
      rowsPerPage: 50,
      searchQuery: '',
      selectedPlayerId: null
    });
  });

  it('uses real engine ids by default', () => {
    expect(useTableStore.getState().currentEngine).toBe('Default');
  });

  it('syncs import status into compat dom surfaces', () => {
    useTableStore.getState().setImportStatus({
      canRetry: true,
      details: ['duplicate file'],
      kind: 'error',
      message: 'Import completed with errors.'
    });

    expect(
      document.querySelector('#upload-status-text .upload-status-content')?.textContent
    ).toContain('Import completed with errors.');
    expect(document.querySelector('#error-log .error-log-content')?.textContent).toContain(
      'duplicate file'
    );
    expect(document.querySelector('#retry-error-container')?.classList.contains('hidden')).toBe(
      false
    );
  });

  it('mirrors sort changes into the legacy table store', () => {
    useTableStore.getState().setSort({ col: 'name', dir: 'asc' });

    expect(legacyTableStore.currentSort).toEqual({ col: 'name', dir: 'asc' });
    expect(useTableStore.getState().compatRevision).toBe(1);
  });

  it('clears React and legacy filters together', () => {
    legacyTableStore.activeFilters = { club: ['Legia'] } as any;
    useTableStore.setState({
      activeFilters: { club: ['Legia'] } as any,
      searchQuery: 'legia'
    });

    useTableStore.getState().clearFilters();

    expect(useTableStore.getState().searchQuery).toBe('');
    expect(useTableStore.getState().activeFilters).toEqual({});
    expect(legacyTableStore.activeFilters).toEqual({});
    expect(useTableStore.getState().compatRevision).toBe(1);
  });

  it('keeps current page mirrored with the legacy table store', () => {
    useTableStore.getState().setCurrentPage(3);

    expect(useTableStore.getState().currentPage).toBe(3);
    expect(legacyTableStore.currentPage).toBe(3);
  });

  it('applies search filters through React and legacy state', () => {
    useTableStore.getState().applyColumnFilter('name', 'search', { search: ' Richardson ' });

    expect(useTableStore.getState().activeFilters).toEqual({ name: 'richardson' });
    expect(legacyTableStore.activeFilters).toEqual({ name: 'richardson' });
    expect(legacyTableStore.currentPage).toBe(1);
    expect(legacyTableStore.filterDirty).toBe(true);
    expect(legacyTableStore.headersDirty).toBe(true);
    expect(useTableStore.getState().compatRevision).toBe(1);
  });

  it('applies and clears range filters through React and legacy state', () => {
    useTableStore.getState().applyColumnFilter('age', 'range', { max: '24', min: '18' });

    expect(legacyTableStore.activeFilters).toEqual({ age: { max: 24, min: 18 } });

    useTableStore.getState().applyColumnFilter('age', 'range', { max: '', min: '' });

    expect(useTableStore.getState().activeFilters).toEqual({});
    expect(legacyTableStore.activeFilters).toEqual({});
  });

  it('toggles checkbox filters without mutating unrelated filters', () => {
    legacyTableStore.activeFilters = { name: 'richardson' };

    useTableStore.getState().toggleColumnFilterValue('club', 'Legia');
    useTableStore.getState().toggleColumnFilterValue('club', 'Lech');
    useTableStore.getState().toggleColumnFilterValue('club', 'Legia');

    expect(useTableStore.getState().activeFilters).toEqual({
      club: ['Lech'],
      name: 'richardson'
    });
    expect(legacyTableStore.activeFilters).toEqual({
      club: ['Lech'],
      name: 'richardson'
    });
  });

  it('mirrors position filter mode to the legacy store', () => {
    useTableStore.getState().setPositionFilterMode('and');

    expect(legacyTableStore.positionFilterMode).toBe('and');
    expect(useTableStore.getState().compatRevision).toBe(1);
  });

  it('resets to page one when rows per page changes', () => {
    legacyTableStore.currentPage = 4;
    useTableStore.setState({ currentPage: 4 });

    useTableStore.getState().setRowsPerPage(100);

    expect(useTableStore.getState().rowsPerPage).toBe(100);
    expect(useTableStore.getState().currentPage).toBe(1);
    expect(legacyTableStore.rowsPerPage).toBe(100);
    expect(legacyTableStore.currentPage).toBe(1);
  });
});
