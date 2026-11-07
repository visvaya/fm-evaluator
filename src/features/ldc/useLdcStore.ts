/* eslint-disable fp/no-mutation, perfectionist/sort-interfaces, sonarjs/max-lines-per-function */

import { create } from 'zustand';

import {
  beginMappingsTransaction,
  commitMappingsTransaction,
  computeLDC,
  ensureLdcMappingsLoadedAsync,
  loadDefaultLDCData,
  loadLeagueMappings,
  normalizeLeagueMappings,
  rollbackMappingsTransaction,
  saveLeagueMappings
} from '@/computing/ldc';
import { convertLeaguesForModel } from '@/computing/ldcModelConversion';
import { checkOrderConsistency, findLeaguesWithSameLDC } from '@/computing/ldcUtils';
import { DEFAULT_LDC_SETTINGS, ldcSettings } from '@/config/ldcConfig';

import {
  buildPersistedLdcSettingsPayload,
  loadPersistedLdcSettings,
  savePersistedLdcSettings
} from './ldcPersistence';

import type {
  BasketProblem,
  LDCModel,
  LDCSettings,
  LeagueMappings,
  LdcSortColumn,
  LDCSnapshot,
  LeagueData,
  OrderProblem
} from '@/config/ldcConfig';

interface LdcHistorySnapshot extends LDCSnapshot {
  coalesceKey?: string;
  enabled: boolean;
}

interface HydrateOptions {
  force?: boolean;
}

interface SyncOptions {
  persist?: boolean;
  pushHistory?: boolean;
}

export type LdcLeagueFilter =
  | 'all'
  | 'with-mappings'
  | 'with-problems'
  | 'without-mappings'
  | 'without-stars';

interface LdcStoreState {
  basketProblems: BasketProblem[];
  beginEditSession: () => void;
  cancelEditSession: () => Promise<void>;
  clearSelectedLeagueIds: () => void;
  historyIndex: number;
  historyStack: LdcHistorySnapshot[];
  hydrateFromPersistence: (options?: HydrateOptions) => Promise<void>;
  isHydrated: boolean;
  isHydrating: boolean;
  isLeaguesExpanded: boolean;
  leagueFilter: LdcLeagueFilter;
  orderProblems: OrderProblem[];
  persistSettings: () => Promise<void>;
  commitEditSession: () => Promise<void>;
  redo: () => boolean;
  searchTerm: string;
  sessionBaseline: LdcHistorySnapshot | null;
  setAlphaBasket: (value: number) => void;
  setAlphaSimple: (value: number) => void;
  setEnabled: (enabled: boolean) => void;
  setGroupBy: (groupBy: null | string) => void;
  setLeagueFilter: (leagueFilter: LdcLeagueFilter) => void;
  setLeaguesExpanded: (isExpanded: boolean) => void;
  setModel: (model: LDCModel) => void;
  setSearchTerm: (searchTerm: string) => void;
  selectedLeagueIds: string[];
  setSelectedLeagueIds: (selectedLeagueIds: string[]) => void;
  setSortColumn: (sortColumn: LdcSortColumn) => void;
  settings: LDCSettings;
  syncFromLegacy: (options?: SyncOptions) => Promise<void>;
  toggleSelectedLeagueId: (leagueId: string) => void;
  undo: () => boolean;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cloneSettings(settings: LDCSettings): LDCSettings {
  return {
    ...settings,
    leagues: clone(settings.leagues)
  };
}

const leagueIdState = {
  next: 1
};

function createLeagueId() {
  const leagueId = `ldc-league-${leagueIdState.next}`;
  leagueIdState.next += 1;
  return leagueId;
}

function normalizeLeagues(leagues: LeagueData[]) {
  const seenIds = new Set<string>();

  return leagues.map((league, index) => {
    const existingId =
      typeof league.id === 'string' && league.id.length > 0 && !seenIds.has(league.id)
        ? league.id
        : createLeagueId();
    seenIds.add(existingId);

    return {
      ...league,
      id: existingId,
      rank: index + 1
    };
  });
}

function readLegacySettings(): LDCSettings {
  return cloneSettings({
    alphaBasket: ldcSettings.alphaBasket,
    alphaSimple: ldcSettings.alphaSimple,
    baseLeague: ldcSettings.baseLeague,
    baseLeagueNation: ldcSettings.baseLeagueNation,
    enabled: ldcSettings.enabled,
    groupBy: ldcSettings.groupBy,
    leagues: clone(ldcSettings.leagues),
    model: ldcSettings.model,
    sortColumn: ldcSettings.sortColumn,
    sortDirection: ldcSettings.sortDirection
  });
}

function writeLegacySettings(settings: LDCSettings) {
  const nextSettings = cloneSettings(settings);
  ldcSettings.alphaBasket = nextSettings.alphaBasket;
  ldcSettings.alphaSimple = nextSettings.alphaSimple;
  ldcSettings.baseLeague = nextSettings.baseLeague;
  ldcSettings.baseLeagueNation = nextSettings.baseLeagueNation ?? '';
  ldcSettings.enabled = nextSettings.enabled;
  ldcSettings.groupBy = nextSettings.groupBy;
  ldcSettings.leagues = normalizeLeagues(nextSettings.leagues);
  ldcSettings.model = nextSettings.model;
  ldcSettings.sortColumn = nextSettings.sortColumn;
  ldcSettings.sortDirection = nextSettings.sortDirection;
}

function buildSettingsFromPayload(
  payload: Awaited<ReturnType<typeof loadPersistedLdcSettings>>
): LDCSettings {
  return {
    alphaBasket: payload?.alphaBasket ?? DEFAULT_LDC_SETTINGS.alphaBasket,
    alphaSimple: payload?.alphaSimple ?? DEFAULT_LDC_SETTINGS.alphaSimple,
    baseLeague: payload?.baseLeague ?? DEFAULT_LDC_SETTINGS.baseLeague,
    baseLeagueNation: payload?.baseLeagueNation ?? '',
    enabled: payload?.enabled ?? DEFAULT_LDC_SETTINGS.enabled,
    groupBy: DEFAULT_LDC_SETTINGS.groupBy,
    leagues: normalizeLeagues(payload?.leagues ?? []),
    model: payload?.model ?? DEFAULT_LDC_SETTINGS.model,
    sortColumn: payload?.sortColumn ?? DEFAULT_LDC_SETTINGS.sortColumn,
    sortDirection: payload?.sortDirection ?? DEFAULT_LDC_SETTINGS.sortDirection
  };
}

function buildHistorySnapshot(settings: LDCSettings, mappings: LeagueMappings): LdcHistorySnapshot {
  return {
    alphaBasket: settings.alphaBasket,
    alphaSimple: settings.alphaSimple,
    baseLeague: settings.baseLeague,
    baseLeagueNation: settings.baseLeagueNation,
    enabled: settings.enabled,
    leagues: clone(settings.leagues),
    mappings: clone(mappings),
    model: settings.model,
    sortColumn: settings.sortColumn,
    sortDirection: settings.sortDirection,
    timestamp: Date.now()
  };
}

function deriveProblems(settings: LDCSettings) {
  return {
    // Duplicate ldcRaw values are a problem in both models; suggestion
    // wording is model-aware inside suggestBasketFix.
    basketProblems: findLeaguesWithSameLDC(),
    orderProblems: checkOrderConsistency(settings.leagues)
  };
}

function computeStateFromSettings(settings: LDCSettings, mappings: LeagueMappings) {
  saveLeagueMappings(clone(mappings));
  writeLegacySettings(settings);
  computeLDC();
  const computedSettings = readLegacySettings();
  return {
    ...deriveProblems(computedSettings),
    settings: computedSettings
  };
}

function applyHistorySnapshot(snapshot: LdcHistorySnapshot) {
  return computeStateFromSettings(
    {
      alphaBasket: snapshot.alphaBasket,
      alphaSimple: snapshot.alphaSimple,
      baseLeague: snapshot.baseLeague,
      baseLeagueNation: snapshot.baseLeagueNation,
      enabled: snapshot.enabled,
      groupBy: DEFAULT_LDC_SETTINGS.groupBy,
      leagues: normalizeLeagues(snapshot.leagues),
      model: snapshot.model,
      sortColumn: snapshot.sortColumn,
      sortDirection: snapshot.sortDirection
    },
    snapshot.mappings
  );
}

const HISTORY_COALESCE_WINDOW_MS = 1000;

function pushHistory(
  historyStack: LdcHistorySnapshot[],
  historyIndex: number,
  snapshot: LdcHistorySnapshot,
  coalesceKey?: string
) {
  const truncatedStack =
    historyIndex < historyStack.length - 1 ? historyStack.slice(0, historyIndex + 1) : historyStack;
  const stampedSnapshot = coalesceKey === undefined ? snapshot : { ...snapshot, coalesceKey };
  const topSnapshot = truncatedStack.at(-1);

  // Rapid same-source changes (e.g. dragging an alpha slider) replace the top
  // entry instead of flooding the undo stack with intermediate values.
  if (
    coalesceKey !== undefined &&
    topSnapshot?.coalesceKey === coalesceKey &&
    stampedSnapshot.timestamp - topSnapshot.timestamp < HISTORY_COALESCE_WINDOW_MS
  ) {
    const nextStack = [...truncatedStack.slice(0, -1), stampedSnapshot];
    return { historyIndex: nextStack.length - 1, historyStack: nextStack };
  }

  const nextStack =
    truncatedStack.length + 1 > 50
      ? [...truncatedStack, stampedSnapshot].slice(-50)
      : [...truncatedStack, stampedSnapshot];
  const nextIndex = nextStack.length - 1;

  return {
    historyIndex: nextIndex,
    historyStack: nextStack
  };
}

async function buildInitialSettings() {
  const payload = await loadPersistedLdcSettings();
  const mappings = normalizeLeagueMappings(clone(payload?.mappings ?? loadLeagueMappings()));
  const settings = buildSettingsFromPayload(payload);

  return {
    mappings,
    settings:
      settings.leagues.length > 0
        ? settings
        : {
            ...settings,
            leagues: normalizeLeagues(await loadDefaultLDCData())
          }
  };
}

// This compat store still carries both persistence and legacy synchronization concerns.
// Splitting it further is follow-up work after the React-owned table path is stable.
export const useLdcStore = create<LdcStoreState>((set, get) => ({
  basketProblems: [],
  beginEditSession: () => {
    if (get().sessionBaseline !== null) {
      return;
    }

    beginMappingsTransaction();
    const settings = readLegacySettings();
    const mappings = clone(loadLeagueMappings());
    const baseline = buildHistorySnapshot(settings, mappings);
    set({
      historyIndex: 0,
      historyStack: [baseline],
      sessionBaseline: baseline
    });
  },
  cancelEditSession: async () => {
    const baseline = get().sessionBaseline;
    if (baseline === null) {
      return;
    }

    rollbackMappingsTransaction();
    const computed = applyHistorySnapshot(baseline);
    set({
      ...computed,
      historyIndex: 0,
      historyStack: [baseline],
      selectedLeagueIds: [],
      sessionBaseline: null
    });
    await savePersistedLdcSettings(buildPersistedLdcSettingsPayload());
  },
  clearSelectedLeagueIds: () => set({ selectedLeagueIds: [] }),
  commitEditSession: async () => {
    commitMappingsTransaction();
    await savePersistedLdcSettings(buildPersistedLdcSettingsPayload());
    set({ sessionBaseline: null });
  },
  historyIndex: -1,
  historyStack: [],
  hydrateFromPersistence: async ({ force } = {}) => {
    const state = get();
    if (state.isHydrating || (state.isHydrated && !force)) {
      return;
    }

    set({ isHydrating: true });
    // Clear any dangling transaction left by an interrupted edit session.
    rollbackMappingsTransaction();
    await ensureLdcMappingsLoadedAsync();
    const { mappings, settings } = await buildInitialSettings();
    const computed = computeStateFromSettings(settings, mappings);
    const snapshot = buildHistorySnapshot(computed.settings, mappings);

    set({
      ...computed,
      historyIndex: 0,
      historyStack: [snapshot],
      isHydrated: true,
      isHydrating: false,
      sessionBaseline: null
    });
  },
  isHydrated: false,
  isHydrating: false,
  isLeaguesExpanded: false,
  leagueFilter: 'all',
  orderProblems: [],
  persistSettings: async () => {
    // Inside a draft session persistence is deferred to commitEditSession, so
    // import/reset flows cannot leak an unapplied draft into storage.
    if (get().sessionBaseline !== null) {
      return;
    }

    await savePersistedLdcSettings(buildPersistedLdcSettingsPayload());
  },
  redo: () => {
    const { historyIndex, historyStack } = get();
    if (historyIndex >= historyStack.length - 1) {
      return false;
    }

    const nextIndex = historyIndex + 1;
    const computed = applyHistorySnapshot(historyStack[nextIndex]);
    set({
      ...computed,
      historyIndex: nextIndex
    });
    return true;
  },
  searchTerm: '',
  sessionBaseline: null,
  setAlphaBasket: (value) => {
    const nextSettings = cloneSettings(get().settings);
    nextSettings.alphaBasket = value;
    const mappings = clone(loadLeagueMappings());
    const computed = computeStateFromSettings(nextSettings, mappings);
    const history = pushHistory(
      get().historyStack,
      get().historyIndex,
      buildHistorySnapshot(computed.settings, mappings),
      'alpha-basket'
    );

    set({
      ...computed,
      ...history,
      isHydrated: true
    });
  },
  setAlphaSimple: (value) => {
    const nextSettings = cloneSettings(get().settings);
    nextSettings.alphaSimple = value;
    const mappings = clone(loadLeagueMappings());
    const computed = computeStateFromSettings(nextSettings, mappings);
    const history = pushHistory(
      get().historyStack,
      get().historyIndex,
      buildHistorySnapshot(computed.settings, mappings),
      'alpha-simple'
    );

    set({
      ...computed,
      ...history,
      isHydrated: true
    });
  },
  setEnabled: (enabled) => {
    const nextSettings = cloneSettings(get().settings);
    nextSettings.enabled = enabled;
    writeLegacySettings(nextSettings);
    const settings = readLegacySettings();
    set({
      ...deriveProblems(settings),
      isHydrated: true,
      settings
    });
    // Outside a draft session there is no later commit step, so persist now.
    if (get().sessionBaseline === null) {
      void savePersistedLdcSettings(buildPersistedLdcSettingsPayload());
    }
  },
  setGroupBy: (groupBy) => {
    const nextSettings = cloneSettings(get().settings);
    nextSettings.groupBy = groupBy;
    writeLegacySettings(nextSettings);
    set({
      settings: readLegacySettings()
    });
  },
  setLeagueFilter: (leagueFilter) => set({ leagueFilter }),
  setLeaguesExpanded: (isLeaguesExpanded) => set({ isLeaguesExpanded }),
  setModel: (model) => {
    const nextSettings = cloneSettings(get().settings);
    nextSettings.model = model;
    nextSettings.leagues = normalizeLeagues(convertLeaguesForModel(nextSettings.leagues, model));
    const mappings = clone(loadLeagueMappings());
    const computed = computeStateFromSettings(nextSettings, mappings);
    const history = pushHistory(
      get().historyStack,
      get().historyIndex,
      buildHistorySnapshot(computed.settings, mappings)
    );

    set({
      ...computed,
      ...history,
      isHydrated: true
    });
  },
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setSelectedLeagueIds: (selectedLeagueIds) =>
    set({
      selectedLeagueIds: [...new Set(selectedLeagueIds)]
    }),
  setSortColumn: (sortColumn) => {
    const nextSettings = cloneSettings(get().settings);
    nextSettings.sortDirection =
      nextSettings.sortColumn === sortColumn && nextSettings.sortDirection === 'asc'
        ? 'desc'
        : 'asc';
    nextSettings.sortColumn = sortColumn;
    writeLegacySettings(nextSettings);
    set({
      settings: readLegacySettings()
    });
  },
  settings: cloneSettings(DEFAULT_LDC_SETTINGS),
  syncFromLegacy: async ({ persist, pushHistory: shouldPushHistory = true } = {}) => {
    const settings = readLegacySettings();
    const mappings = clone(loadLeagueMappings());
    const computed = {
      ...deriveProblems(settings),
      settings
    };

    if (shouldPushHistory) {
      const history = pushHistory(
        get().historyStack,
        get().historyIndex,
        buildHistorySnapshot(settings, mappings)
      );
      set({
        ...computed,
        ...history,
        isHydrated: true
      });
    } else {
      set({
        ...computed,
        isHydrated: true
      });
    }

    if (persist) {
      await savePersistedLdcSettings(buildPersistedLdcSettingsPayload());
    }
  },
  selectedLeagueIds: [],
  toggleSelectedLeagueId: (leagueId) =>
    set((state) => {
      const selectedLeagueIds = new Set(state.selectedLeagueIds);
      if (selectedLeagueIds.has(leagueId)) {
        selectedLeagueIds.delete(leagueId);
      } else {
        selectedLeagueIds.add(leagueId);
      }

      return {
        selectedLeagueIds: [...selectedLeagueIds]
      };
    }),
  undo: () => {
    const { historyIndex, historyStack } = get();
    if (historyIndex <= 0) {
      return false;
    }

    const nextIndex = historyIndex - 1;
    const computed = applyHistorySnapshot(historyStack[nextIndex]);
    set({
      ...computed,
      historyIndex: nextIndex
    });
    return true;
  }
}));
