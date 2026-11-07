// Adapter bridge between compatibility state and newer TypeScript UI modules
// This remains transitional glue while legacy-backed state is still present.

import { renderTableHeaders } from './header';
import { updatePageInfo } from './pagination';
import { buildRowHtml, renderPagedRows, renderVirtualRows } from './table';

import type { Column, DOMElements, SortState, UIState, VirtualState } from './types';

/**
 * UI Adapter - bridges legacy-compatible global state into newer TS modules
 */
export class UIAdapter {
  private bindHeaderListeners: () => void;
  private getColumns: () => Column[];
  private getElements: () => DOMElements;
  private getState: () => UIState;
  private getVirtualState: () => VirtualState;

  /**
   * Initialize the adapter with state accessors
   */
  init(config: {
    bindHeaderListeners: () => void;
    getColumns: () => Column[];
    getElements: () => DOMElements;
    getState: () => UIState;
    getVirtualState: () => VirtualState;
  }): void {
    this.getState = config.getState;
    this.getElements = config.getElements;
    this.getColumns = config.getColumns;
    this.getVirtualState = config.getVirtualState;
    this.bindHeaderListeners = config.bindHeaderListeners;
  }

  /**
   * Render paged rows using new module
   */
  renderPagedRows(sortedRows: any[]): void {
    const state = this.getState();
    const cols = this.getColumns();
    const els = this.getElements();

    // Guard: ensure DOM element exists
    if (!els.tableBody) {
      console.error('[UIAdapter.renderPagedRows] tableBody element not found');
      return;
    }

    renderPagedRows(
      sortedRows,
      cols,
      state.pinnedColumns,
      state.currentPage,
      state.rowsPerPage,
      els.tableBody,
      (current, max) => {
        // Update current page in legacy state
        state.currentPage = current;
        updatePageInfo(current, max);
      }
    );
  }

  /**
   * Render table headers using new module
   */
  renderTableHeaders(): void {
    const state = this.getState();
    const cols = this.getColumns();
    const els = this.getElements();

    // Guard: ensure DOM element exists
    if (!els.tableHead) {
      console.error('[UIAdapter.renderTableHeaders] tableHead element not found');
      return;
    }

    renderTableHeaders(
      cols,
      state.pinnedColumns,
      state.currentSort,
      state.activeFilters,
      els.tableHead,
      this.bindHeaderListeners
    );
  }

  /**
   * Render virtual rows using new module
   */
  renderVirtualRows(sortedRows: any[], virtualRowHeight: number): void {
    const state = this.getState();
    const cols = this.getColumns();
    const els = this.getElements();
    const virtualState = this.getVirtualState();

    // Guard: ensure DOM element exists
    if (!els.tableBody) {
      console.error('[UIAdapter.renderVirtualRows] tableBody element not found');
      return;
    }

    renderVirtualRows(
      sortedRows,
      cols,
      state.pinnedColumns,
      virtualState,
      virtualRowHeight,
      els.tableBody
    );
  }

  /**
   * Update pagination info using new module
   */
  updatePageInfo(current: number, max: number): void {
    updatePageInfo(current, max);
  }
}

// Singleton instance
export const uiAdapter = new UIAdapter();

// Expose to window for legacy code (temporary bridge)
if (typeof window !== 'undefined') {
  (window as any).uiAdapter = uiAdapter;
}
