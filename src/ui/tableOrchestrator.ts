// Phase 5B: Table rendering orchestration – render pipeline, virtual scroll, sort, pagination
// Migrated from main.js L12480-12632 + L4636 + L11535-11547

import {
  COLUMNS,
  getEls,
  VIRTUAL_BATCH,
  VIRTUAL_BUFFER,
  VIRTUAL_MIN_ROWS,
  VIRTUAL_ROW_HEIGHT
} from '../config/columns';
import { runAnalysis as runAnalysisService } from '../lib/analysisService';
import { getFilterRuntime } from '../lib/filterRuntime';
import { t } from '../lib/i18nBridge';
import { persistUIState } from '../lib/uiBridge';
import { markHeadersDirty, store } from '../store/tableStore';
import { debounce } from '../utils/helpers';

import { buildActiveColumns } from './columnManager';
import { getFilteredData, getSortedData } from './filterData';

export function renderEmptyState(activeCols: any[]): void {
  const els = getEls();
  const colSpan = activeCols?.length || COLUMNS.length || 1;
  if (els.tableBody) {
    els.tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="p-12 text-center text-gray-400 font-mono">${t('no_data_filters')}</td></tr>`;
  }
}

export function renderTableHeaders(force = false): void {
  if (!force && !store.headersDirty) return;

  const activeCols = buildActiveColumns();
  store.currentColumns = activeCols;

  if (
    (window as any).uiAdapter &&
    typeof (window as any).uiAdapter.renderTableHeaders === 'function'
  ) {
    (window as any).uiAdapter.renderTableHeaders();
    store.headersDirty = false;
  }
}

export function renderTableImmediate(): void {
  const els = getEls();
  const totalRows = getFilterRuntime().calculatedScores.length;
  const virtualState = store.virtualState;

  const tableScroller = document.querySelector('#table-scroller');
  const paginationEl = document.querySelector('#pagination-controls');
  if (tableScroller && !tableScroller.classList.contains('hidden') && paginationEl) {
    paginationEl.classList.remove('hidden');
  }
  if (store.headersDirty) renderTableHeaders(true);
  if (totalRows === 0) {
    store.currentPage = 0;
    renderEmptyState(store.currentColumns);
    updateResultsMeta(0);
    updatePageInfo(0, 0);
    return;
  }
  const filtered = getFilteredData();
  const sorted = getSortedData(filtered);
  store.lastSortedRows = sorted;
  const shouldVirtualize = sorted.length > VIRTUAL_MIN_ROWS;
  virtualState.total = sorted.length;
  if (shouldVirtualize) {
    if (!virtualState.enabled && els.tableScroller) els.tableScroller.scrollTop = 0;
    virtualState.enabled = true;
    virtualState.end = Math.min(sorted.length, virtualState.start + VIRTUAL_BATCH);
    renderVirtualRows(store.currentColumns);
  } else {
    if (virtualState.enabled && els.tableScroller) els.tableScroller.scrollTop = 0;
    virtualState.enabled = false;
    virtualState.start = 0;
    virtualState.end = Math.min(VIRTUAL_BATCH, sorted.length);
    renderPagedRows(sorted, store.currentColumns);
  }
  updateResultsMeta(sorted.length);
}

export function updatePageInfo(page: number, maxPage: number): void {
  const normalizedMax = Math.max(0, maxPage || 0);
  const normalizedPage = normalizedMax === 0 ? 0 : Math.min(Math.max(page || 1, 1), normalizedMax);
  const pageNumberInput = document.querySelector<HTMLInputElement>('#page-number');
  const pageTotalDisplay = document.querySelector('#page-total-display');
  if (pageNumberInput) {
    pageNumberInput.value = normalizedPage.toString();
    pageNumberInput.max = normalizedMax > 0 ? normalizedMax.toString() : '1';
  }
  if (pageTotalDisplay) {
    pageTotalDisplay.textContent = ` ${t('of')} ${normalizedMax}`;
  }
  const disablePrev = normalizedMax === 0 || normalizedPage <= 1;
  const disableNext = normalizedMax === 0 || normalizedPage >= normalizedMax;
  const pageFirst = document.querySelector<HTMLButtonElement>('#page-first');
  const pagePrev = document.querySelector<HTMLButtonElement>('#page-prev');
  const pageNext = document.querySelector<HTMLButtonElement>('#page-next');
  const pageLast = document.querySelector<HTMLButtonElement>('#page-last');
  if (pageFirst) pageFirst.disabled = disablePrev;
  if (pagePrev) pagePrev.disabled = disablePrev;
  if (pageNext) pageNext.disabled = disableNext;
  if (pageLast) pageLast.disabled = disableNext;
}

export function updateResultsMeta(filteredCount: number): void {
  const resultsCountEl = document.querySelector('#results-count');
  if (resultsCountEl) {
    resultsCountEl.textContent = t('showing_results', 'ui', {
      count: filteredCount,
      total: getFilterRuntime().calculatedScores.length
    });
  }
}

function renderPagedRows(sorted: any[], activeCols: any[]): void {
  if (
    (window as any).uiAdapter &&
    typeof (window as any).uiAdapter.renderPagedRows === 'function'
  ) {
    (window as any).uiAdapter.renderPagedRows(sorted);
  }
}

function renderVirtualRows(activeCols: any[]): void {
  if (
    (window as any).uiAdapter &&
    typeof (window as any).uiAdapter.renderVirtualRows === 'function'
  ) {
    (window as any).uiAdapter.renderVirtualRows(store.lastSortedRows, VIRTUAL_ROW_HEIGHT);
  }
}

export const scheduleTableRender = debounce(
  () => window.requestAnimationFrame(renderTableImmediate),
  16
);

export const handleVirtualScroll = debounce(() => {
  const els = getEls();
  const virtualState = store.virtualState;
  if (!virtualState.enabled) return;
  const top = els.tableScroller.scrollTop;
  const start = Math.max(0, Math.floor(top / VIRTUAL_ROW_HEIGHT) - VIRTUAL_BUFFER);
  const end = Math.min(virtualState.total, start + VIRTUAL_BATCH);
  if (start === virtualState.start && end === virtualState.end) return;
  virtualState.start = start;
  virtualState.end = end;
  renderVirtualRows(store.currentColumns);
}, 16);

/**
 * Legacy table binding, reference for React parity. Unused today; kept until the React/TS migration decides its fate.
 * @public
 */
export function bindVirtualScroll(): void {
  const els = getEls();
  if (els.tableScroller) {
    els.tableScroller.addEventListener('scroll', handleVirtualScroll, { passive: true });
  }
}

export function changePage(d: string): void {
  const filteredLength = getFilteredData().length;
  const max = filteredLength === 0 ? 0 : Math.ceil(filteredLength / store.rowsPerPage);
  if (max === 0) {
    store.currentPage = 0;
    scheduleTableRender();
    return;
  }
  switch (d) {
    case 'first': {
      store.currentPage = 1;
      break;
    }
    case 'next': {
      store.currentPage++;
      break;
    }
    case 'prev': {
      store.currentPage--;
      break;
    }
    default: {
      store.currentPage = max;
    }
  }
  store.currentPage = Math.max(1, Math.min(max, store.currentPage));
  scheduleTableRender();
}

export function handleSort(col: string): void {
  if ((window as any).tableState) {
    (window as any).tableState.setSort(col);
    return;
  }
  if (store.currentSort.col === col)
    store.currentSort.dir = store.currentSort.dir === 'asc' ? 'desc' : 'asc';
  else store.currentSort = { col, dir: 'desc' };
  store.currentPage = 1;
  markHeadersDirty();
  persistUIState();
  scheduleTableRender();
}

export function runAnalysis(): void {
  const virtualState = store.virtualState;
  const eng = document.querySelector<HTMLSelectElement>('#engine-select')?.value;
  const pos = document.querySelector<HTMLSelectElement>('#position-select')?.value;
  if (!pos) return;
  const loadingOverlay = document.querySelector<HTMLElement>('#loading-overlay');
  if (loadingOverlay) loadingOverlay.style.display = 'flex';

  const tableScroller = document.querySelector('#table-scroller');
  if (tableScroller) tableScroller.classList.remove('hidden');
  const paginationControls = document.querySelector('#pagination-controls');
  if (paginationControls) paginationControls.classList.remove('hidden');

  setTimeout(() => {
    try {
      runAnalysisService(eng, pos);
      store.currentPage = 1;
      store.filteredDataCache = [];
      store.lastSortedRows = [];
      store.filterDirty = true;
      virtualState.start = 0;
      virtualState.end = VIRTUAL_BATCH;
      markHeadersDirty();
      scheduleTableRender();
    } catch (error: any) {
      console.error('[runAnalysis] Error during analysis:', error);
      const errorLog = document.querySelector('#error-log');
      if (errorLog) {
        const content = errorLog.querySelector('.error-log-content');
        if (content)
          content.textContent = `Błąd podczas analizy: ${error.message || 'Nieoczekiwany błąd'}`;
        errorLog.classList.remove('hidden');
      }
    } finally {
      if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
  }, 50);
}
