import { getPlayerRuntimeRows } from '@/lib/playerRuntimeCache';
import { useTableStore } from '@/store/useTableStore';

import type { Player } from '@/ui/types';

export function getActivePlayerRows(): readonly Player[] {
  const state = useTableStore.getState();

  if (state.analysisReady) {
    return state.data;
  }

  const importedRows = getPlayerRuntimeRows();
  return importedRows.length > 0 ? (importedRows as readonly Player[]) : state.data;
}

export function hasActivePlayerRows(): boolean {
  return getActivePlayerRows().length > 0;
}

export function hasAnalyzedPlayerRows(): boolean {
  const state = useTableStore.getState();
  return state.analysisReady && state.data.length > 0;
}
