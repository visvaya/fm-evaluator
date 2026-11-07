import { scheduleTableRender } from './lib/uiBridge';
import { saveUIState } from './storage/state';
import { markHeadersDirty, store } from './store/tableStore';

export function hydrateFromStoredState() {
  const w: any = window as any;
  if (typeof w.hydrateUIState === 'function') {
    w.hydrateUIState();
  }
}

export function setSort(col: string) {
  const current = store.currentSort;
  store.currentSort =
    current.col === col
      ? { col, dir: current.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'desc' };
  store.currentPage = 1;
  markHeadersDirty();
  persist();
  scheduleTableRender();
}

export function toggleHidden(id: string) {
  if (store.hiddenColumns.includes(id)) {
    store.hiddenColumns = store.hiddenColumns.filter((x: string) => x !== id);
  } else {
    store.hiddenColumns.push(id);
  }
  markHeadersDirty();
  store.currentPage = 1;
  persist();
  scheduleTableRender();
}

export function togglePinned(id: string) {
  if (store.pinnedColumns.includes(id)) {
    store.pinnedColumns = store.pinnedColumns.filter((x: string) => x !== id);
  } else {
    store.pinnedColumns.push(id);
  }
  markHeadersDirty();
  store.currentPage = 1;
  persist();
  scheduleTableRender();
}

function persist() {
  const w: any = window as any;
  const columnWidths: Record<string, number> = {};
  if (w.COLUMNS) {
    w.COLUMNS.forEach((c: any) => {
      if (c.savedWidth) columnWidths[c.id] = c.savedWidth;
    });
  }
  const columnOrder = w.COLUMNS ? w.COLUMNS.map((c: any) => c.id) : [];

  saveUIState(
    {
      activeFilters: store.activeFilters,
      columnOrder,
      columnWidths,
      currentSort: store.currentSort,
      hiddenColumns: store.hiddenColumns,
      pinnedColumns: store.pinnedColumns,
      positionFilterMode: store.positionFilterMode,
      roleFiltersEnabled: store.roleFiltersEnabled,
      rowsPerPage: store.rowsPerPage
    },
    w.APP_SETTINGS,
    w.processor
  );
}
