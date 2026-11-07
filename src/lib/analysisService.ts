/* eslint-disable fp/no-mutation */

import { processor } from '@/data/dataProcessor';
import { createPlayerDetailsComparisonRuntimeFromProcessor } from '@/features/playerDetails/comparisonRuntime';
import { setPlayerRuntimeRows } from '@/lib/playerRuntimeCache';
import { markFiltersDirty, store as legacyTableStore } from '@/store/tableStore';
import { getEffectiveMinMins } from '@/store/useSettingsStore';
import { useTableStore } from '@/store/useTableStore';

export function runAnalysis(selectedEngine?: string, selectedPosition?: string): any[] {
  const state = useTableStore.getState();
  const engine = selectedEngine || state.currentEngine || 'Default';
  const position = selectedPosition || state.currentPosition || '';

  if (!position) {
    return [];
  }

  state.setEngine(engine as typeof state.currentEngine);
  state.setPosition(position);
  state.setAnalyzing(true);

  try {
    processor.calculateScores(engine, position);
    const results = processor.calculatedScores || [];
    markFiltersDirty();
    legacyTableStore.filteredDataCache = [];
    legacyTableStore.lastSortedRows = [];
    state.setData(results);
    state.setFilteredData(results);
    state.setAnalysisReady(results.length > 0);
    state.setComparisonRuntime(
      createPlayerDetailsComparisonRuntimeFromProcessor(getEffectiveMinMins())
    );
    setPlayerRuntimeRows(processor.mergedData);
    return results;
  } finally {
    state.setAnalyzing(false);
  }
}
