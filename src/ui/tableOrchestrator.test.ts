// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { buildActiveColumns, getFilterRuntime, getFilteredData, getSortedData, runAnalysisService } =
  vi.hoisted(() => ({
    buildActiveColumns: vi.fn(() => [{ id: 'name', name: 'Name' }]),
    getFilterRuntime: vi.fn(() => ({
      calculatedScores: []
    })),
    getFilteredData: vi.fn(() => []),
    getSortedData: vi.fn((rows: any[]) => rows),
    runAnalysisService: vi.fn()
  }));

vi.mock('../config/columns', () => ({
  COLUMNS: [{ id: 'name', name: 'Name' }],
  VIRTUAL_BATCH: 160,
  VIRTUAL_BUFFER: 40,
  VIRTUAL_MIN_ROWS: Number.MAX_SAFE_INTEGER,
  VIRTUAL_ROW_HEIGHT: 46,
  getEls: () => ({
    tableBody: document.querySelector('#table-body'),
    tableScroller: document.querySelector('#table-scroller')
  })
}));

vi.mock('./columnManager', () => ({
  buildActiveColumns
}));

vi.mock('./filterData', () => ({
  getFilteredData,
  getSortedData
}));

vi.mock('../lib/analysisService', () => ({
  runAnalysis: runAnalysisService
}));

vi.mock('../lib/filterRuntime', () => ({
  getFilterRuntime
}));

import { store } from '../store/tableStore';
import { renderTableImmediate, runAnalysis, updateResultsMeta } from './tableOrchestrator';

describe('tableOrchestrator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    document.body.innerHTML = `
      <div id="loading-overlay" style="display:none"></div>
      <div id="pagination-controls" class="hidden"></div>
      <select id="engine-select"><option value="FMTweak" selected>FMTweak</option></select>
      <select id="position-select"><option value="BEST" selected>BEST</option></select>
      <div id="error-log" class="hidden"><div class="error-log-content"></div></div>
      <div id="results-count"></div>
      <table><tbody id="table-body"></tbody></table>
      <div id="table-scroller" class="hidden"></div>
    `;
    (window as any).i18n = {
      t: (key: string, _category: string, params?: { count?: number; total?: number }) =>
        key === 'showing_results' ? `${params?.count ?? 'x'}/${params?.total ?? 'y'}` : key
    };
    store.currentColumns = [];
    store.currentPage = 3;
    store.filteredDataCache = [{ uid: 'stale' }];
    store.lastSortedRows = [{ uid: 'stale' }];
    store.filterDirty = false;
    store.headersDirty = true;
    store.virtualState = { enabled: false, end: 99, start: 12, total: 0 };
  });

  it('renders empty state from the shared runtime row count', () => {
    getFilterRuntime.mockReturnValue({ calculatedScores: [] });

    renderTableImmediate();

    expect(buildActiveColumns).toHaveBeenCalled();
    expect(document.querySelector('#table-body')?.textContent).toContain('no_data_filters');
    expect(store.currentPage).toBe(0);
    expect(document.querySelector('#results-count')?.textContent).toBe('0/0');
  });

  it('updates results meta from the shared runtime row count', () => {
    getFilterRuntime.mockReturnValue({
      calculatedScores: [{ uid: '1' }, { uid: '2' }, { uid: '3' }]
    });

    updateResultsMeta(2);

    expect(document.querySelector('#results-count')?.textContent).toBe('2/3');
  });

  it('delegates analysis through analysisService and resets legacy table state', () => {
    runAnalysis();
    vi.runAllTimers();

    expect(runAnalysisService).toHaveBeenCalledWith('FMTweak', 'BEST');
    expect(store.currentPage).toBe(1);
    expect(store.filteredDataCache).toEqual([]);
    expect(store.lastSortedRows).toEqual([]);
    expect(store.filterDirty).toBe(true);
    expect(store.virtualState.start).toBe(0);
    expect(store.headersDirty).toBe(true);
  });
});
