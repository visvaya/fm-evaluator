// Apply saved UI state back to centralized store and trigger rerenders.
import { requestTableSync } from './lib/reactTableCompat';
import { markFiltersDirty, markHeadersDirty, store } from './store/tableStore';

export function applyLegacyUIState(state: any) {
  if (!state || typeof state !== 'object') return;

  const w: any = window as any;

  store.activeFilters = state.activeFilters || {};
  store.hiddenColumns = state.hiddenColumns || [];
  store.pinnedColumns = state.pinnedColumns || [];
  store.roleFiltersEnabled = !!state.roleFiltersEnabled;
  store.rowsPerPage = state.rowsPerPage || store.rowsPerPage || 50;
  store.currentSort = state.currentSort || store.currentSort;
  store.positionFilterMode = state.positionFilterMode || 'or';

  if (w.COLUMNS && state.columnWidths) {
    w.COLUMNS.forEach((c: any) => {
      if (state.columnWidths[c.id]) {
        c.savedWidth = state.columnWidths[c.id];
      }
    });
  }

  if (state.columnOrder && Array.isArray(state.columnOrder) && w.COLUMNS) {
    const orderMap = new Map(state.columnOrder.map((id: string, idx: number) => [id, idx]));
    const reorderedColumns = [...w.COLUMNS].toSorted((a: any, b: any) => {
      const ai = (orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) as number;
      const bi = (orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER) as number;
      return ai - bi;
    });
    w.COLUMNS.splice(0, w.COLUMNS.length, ...reorderedColumns);
  }

  // Possession map restore (if present)
  if (state.possessionMap && w.processor?.teamPossessionMap) {
    w.processor.teamPossessionMap = new Map(state.possessionMap);
  }

  // Trigger UI updates
  markFiltersDirty();
  markHeadersDirty();
  requestTableSync();
}
