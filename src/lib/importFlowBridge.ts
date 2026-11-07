import { processor } from '@/data/dataProcessor';
import { t as bridgeT } from '@/lib/i18nBridge';
import { runAnalysis as runImportedAnalysis } from '@/lib/analysisService';
import { clearPlayerRuntimeRows, setPlayerRuntimeRows } from '@/lib/playerRuntimeCache';
import { markFiltersDirty, store as legacyTableStore } from '@/store/tableStore';
import type { Player } from '@/ui/types';
import { useTableStore } from '@/store/useTableStore';

const UI_MESSAGE_FALLBACKS = {
  analysis_zero_rows_fallback:
    'Imported {count} player rows. Automatic analysis for {position} returned 0 rows, so the imported table is shown.',
  imported_player_rows: 'Imported {count} player rows.',
  no_player_data_after_import: 'No player data was produced from the imported files.'
} as const;

function formatFallbackMessage(
  template: string,
  params: Record<string, number | string> = {}
): string {
  return template.replaceAll(/\{(\w+)\}/g, (_match, key: string) => String(params[key] ?? ''));
}

function t(key: string, params?: Record<string, number | string>): string {
  const translated = bridgeT(key, 'ui', params);
  if (translated !== key) return translated;
  return formatFallbackMessage(
    UI_MESSAGE_FALLBACKS[key as keyof typeof UI_MESSAGE_FALLBACKS] ?? key,
    params
  );
}

function normalizePlayer(p: any): Player {
  return {
    ...p,
    club: p.club ?? p.basic_club ?? p.Club ?? p.Klub ?? '',
    league: p.league ?? p.basic_league ?? p.Division ?? p.Liga ?? p.League ?? '',
    name: p.name ?? p.basic_name ?? p.Name ?? p.Nazwisko ?? p['Nazwisko i imię'] ?? 'Unknown',
    uid: String(p.uid ?? p.UID ?? p.basic_uid ?? '')
  };
}

function finalizeImportedData() {
  const state = useTableStore.getState();
  const mergeMode = state.mergeMode === 'merge';

  processor.mergeData(mergeMode);
  processor.calculatedScores = [];
  legacyTableStore.filteredDataCache = [];
  legacyTableStore.lastSortedRows = [];
  markFiltersDirty();

  const mergedPlayers = (processor.mergedData || []).map(normalizePlayer);
  state.setData(mergedPlayers);
  state.setFilteredData(mergedPlayers);
  state.setAnalysisReady(false);
  state.setComparisonRuntime(null);
  setPlayerRuntimeRows(mergedPlayers);

  if (mergedPlayers.length === 0) {
    clearPlayerRuntimeRows();
    state.setImportStatus({
      canRetry: false,
      details: [],
      kind: 'error',
      message: t('no_player_data_after_import')
    });
    return;
  }

  state.setImportStatus({
    canRetry: false,
    details: [],
    kind: 'success',
    message: t('imported_player_rows', { count: mergedPlayers.length })
  });

  if (state.currentPosition) {
    runImportedAnalysis(state.currentEngine, state.currentPosition);

    if (useTableStore.getState().data.length === 0) {
      state.setData(mergedPlayers);
      state.setFilteredData(mergedPlayers);
      state.setAnalysisReady(false);
      state.setComparisonRuntime(null);
      setPlayerRuntimeRows(mergedPlayers);
      state.setImportStatus({
        canRetry: false,
        details: [],
        kind: 'info',
        message: t('analysis_zero_rows_fallback', {
          count: mergedPlayers.length,
          position: state.currentPosition
        })
      });
    }
  }
}

export function continueImportFlowProcessing(): void {
  finalizeImportedData();
}

export function registerImportFlowBridge() {
  (window as Window & { onContinueFileProcessing?: () => void }).onContinueFileProcessing =
    continueImportFlowProcessing;
}
