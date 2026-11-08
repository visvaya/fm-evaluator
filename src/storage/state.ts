import { type AppSettings } from '../config/settingsModel';

import { clearAll as clearDb, loadUIStateDb, saveUIStateDb } from './db';

interface UIState {
  activeFilters: Record<string, any>;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  currentSort: any;
  hiddenColumns: string[];
  pinnedColumns: string[];
  positionFilterMode: 'and' | 'or';
  possessionMap: [string, number][];
  rememberLanguageChoice: boolean;
  roleFiltersEnabled: boolean;
  rowsPerPage: number;
}

const STATE_KEY = 'fm24-evaluator-state-v1';
const SETTINGS_KEY = 'fm24-evaluator-settings-v1';
const POSSESSION_KEY = 'fm24-evaluator-possession-v1';
const REMEMBER_LANG_KEY = 'fm24-evaluator-remember-language-choice';

export function clearAllState() {
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(POSSESSION_KEY);
  localStorage.removeItem(REMEMBER_LANG_KEY);
  return clearDb();
}

export function loadUIState() {
  try {
    // Prefer Dexie if available
    return loadUIStateDb()
      .then((data) => {
        if (data) return data;
        const raw = localStorage.getItem(STATE_KEY);
        return raw ? JSON.parse(raw) : null;
      })
      .catch((error) => {
        console.warn('[State] Load (Dexie) failed', error);
        const raw = localStorage.getItem(STATE_KEY);
        return raw ? JSON.parse(raw) : null;
      });
  } catch (error) {
    console.warn('[State] Load failed', error);
    return null;
  }
}

// Legacy sync path (sync) retained for older callers
export function loadUIStateSync() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('[State] Load failed', error);
    return null;
  }
}

export function saveUIState(partial: Partial<UIState>, appSettings: AppSettings, processor: any) {
  try {
    const state: UIState = {
      activeFilters: partial.activeFilters || {},
      columnOrder: partial.columnOrder || [],
      columnWidths: partial.columnWidths || {},
      currentSort: partial.currentSort || null,
      hiddenColumns: partial.hiddenColumns || [],
      pinnedColumns: partial.pinnedColumns || [],
      positionFilterMode: partial.positionFilterMode || 'or',
      possessionMap:
        partial.possessionMap ||
        (processor?.teamPossessionMap ? [...processor.teamPossessionMap.entries()] : []),
      rememberLanguageChoice: partial.rememberLanguageChoice ?? false,
      roleFiltersEnabled: partial.roleFiltersEnabled ?? false,
      rowsPerPage: partial.rowsPerPage ?? 50
    };

    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        defaultPossession: appSettings.defaultPossession,
        maxBeeswarmPlayers: appSettings.maxBeeswarmPlayers,
        minMins: appSettings.minMins,
        normalizeAttr: appSettings.normalizeAttr,
        normalizeStat: appSettings.normalizeStat,
        normalizeTotal: appSettings.normalizeTotal,
        penaltyXGFactor: appSettings.penaltyXGFactor,
        percentile: appSettings.percentile
      })
    );
    localStorage.setItem(REMEMBER_LANG_KEY, (state.rememberLanguageChoice || false).toString());
    localStorage.setItem(POSSESSION_KEY, JSON.stringify({ map: state.possessionMap }));

    // Also persist to Dexie (best-effort)
    saveUIStateDb(state).catch((error) =>
      console.warn('[State] Failed to save UI state to Dexie', error)
    );
  } catch (error) {
    console.warn('[State] Save failed', error);
  }
}
