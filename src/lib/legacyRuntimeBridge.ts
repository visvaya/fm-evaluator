import '../ui/modalQueue.js';
import '../ui/formatVerificationModal.js';
import '../ui/headerMappingModal.js';
import '../../embedded-data.js';

import { COUNTRY_CODE_MAP, FEET_MAPPING, mapCountryCode } from '@/config/constants';
import {
  collator,
  COLUMNS,
  DEFAULT_COLUMNS,
  getEls,
  resetColumns,
  VIRTUAL_BATCH,
  VIRTUAL_BUFFER,
  VIRTUAL_MIN_ROWS,
  VIRTUAL_ROW_HEIGHT
} from '@/config/columns';
import { ldcComputationCache } from '@/config/ldcConfig';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  ALL_ROLES,
  ATTRIBUTE_COEFFS,
  NEGATIVE_STATS,
  PER90_TO_SOURCE,
  PERCENTAGE_TO_SOURCE,
  POSITION_FILTERS,
  SKIPPABLE_STATS,
  STATS_CONFIG,
  ZERO_SKIPPABLE_STATS
} from '@/config/scoreConfig';
import { processor } from '@/data/dataProcessor';
import { handleFiles } from '@/data/handleFiles';
import i18n from '@/i18n';
import { translatePosition, translateValue } from '@/i18n/translate';
import { detectLanguage, setLanguage, updateUI } from '@/i18n/updateUi';
import { registerLegacyActionBridge } from '@/lib/legacyActionBridge';
import { runAnalysis as runImportedAnalysis } from '@/lib/analysisService';
import { continueImportFlowProcessing, registerImportFlowBridge } from '@/lib/importFlowBridge';
import { requestTableSync } from '@/lib/reactTableCompat';
import * as ldcStorage from '@/ldcStorage';
import { addAudit, clearAll as clearAllDb, loadSettings } from '@/storage/db';
import { clearAllState, loadUIState, loadUIStateSync, saveUIState } from '@/storage/state';
import { markFiltersDirty, markHeadersDirty, store } from '@/store/tableStore';
import { useTableStore } from '@/store/useTableStore';
import * as tableState from '@/tableState';
import { applyLegacyUIState } from '@/stateSync';
import { uiAdapter } from '@/ui/adapter';
import { calculatePercentile, getStatPercentile } from '@/ui/statPercentiles';
import {
  buildActiveColumns,
  calculateColumnWidth,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDragStart,
  handleDrop,
  handleHeaderDragEnter,
  handleHeaderDragLeave,
  handleHeaderDragOver,
  handleHeaderDragStart,
  handleHeaderDrop,
  handleResizeStart,
  renderColumnList,
  toggleCol,
  togglePin
} from '@/ui/columnManager';
import { fileStack } from '@/ui/fileStack';
import {
  applyFilter,
  bindFilterClickAway,
  closeFilters,
  copyToClipboard,
  filterCheckboxList,
  filterClubHasPossession,
  filterLDCMatchedLeagues,
  filterShowOnlyLDCMatched,
  openFilter,
  resetAllFilters,
  resetColumnFilter,
  setFilterArr,
  setupScrollInput,
  sortPositionsIntelligently,
  toggleAllVisible,
  toggleShowActiveInFilter,
  updateFilterCounts
} from '@/ui/filters';
import { getFilteredData, getSortedData } from '@/ui/filterData';
import { continueFileProcessing, showLanguageChoiceModal } from '@/ui/languageModal';
import { addLeagueWithValues } from '@/ui/ldcMissing';
import { showAlertModal, showConfirmModal, showModal } from '@/ui/ldcModalHelpers';
import { loadLDCSettings, saveLDCSettings, updateLDCUI } from '@/ui/ldcSettings';
import {
  getBadge,
  getDataBadge,
  getValueRatingBadge,
  renderBar,
  renderRatioCell
} from '@/ui/table';
import {
  changePage,
  handleSort,
  handleVirtualScroll,
  renderEmptyState,
  updatePageInfo,
  updateResultsMeta
} from '@/ui/tableOrchestrator';
import { bindPossessionModalListeners, openPossessionModal } from '@/ui/possessionModal';
import { editOCRResult, removeOCRResult } from '@/ui/possessionOCRDisplay';
import { removeClubPossession, selectPossessionClub } from '@/ui/possessionClubList';
import { createFileMetaHelper } from '@/uploadMeta';
import {
  debounce,
  getFeetStars,
  normalizeDiacritics,
  translateHeaderToInterfaceLang
} from '@/utils/helpers';
import { bootstrapUI } from '@/bootstrap';
import { bindLegacyUpload } from '@/upload';

let runtimeBridgePromise: null | Promise<void> = null;
let compatMirrorsBound = false;
let globalsRegistered = false;

function syncSelectValue(id: string, value: string): void {
  const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (!element) {
    return;
  }

  if (element.value !== value) {
    element.value = value;
  }
}

function syncCompatMirrors(): void {
  const state = useTableStore.getState();
  syncSelectValue('engine-select', state.currentEngine);
  syncSelectValue('central-engine-select', state.currentEngine);
  syncSelectValue('position-select', state.currentPosition);
  syncSelectValue('central-position-select', state.currentPosition);
  syncSelectValue('rows-per-page', String(state.rowsPerPage));
  syncSelectValue('page-number', String(state.currentPage));

  const selectedMergeMode = document.querySelector<HTMLInputElement>(
    `input[name="merge-mode"][value="${state.mergeMode === 'merge' ? 'true' : 'false'}"]`
  );
  if (selectedMergeMode) {
    selectedMergeMode.checked = true;
  }
}

function bindCompatMirrors(): void {
  if (compatMirrorsBound) {
    syncCompatMirrors();
    return;
  }

  compatMirrorsBound = true;
  syncCompatMirrors();
  useTableStore.subscribe(() => syncCompatMirrors());
}

function openReactDetails(uid: string): void {
  useTableStore.getState().setSelectedPlayerId(uid);
}

function registerGlobals(): void {
  if (globalsRegistered) {
    return;
  }

  globalsRegistered = true;
  (window as Window & { persistUIState?: () => void }).persistUIState = () => {};

  Object.assign(window, {
    ALL_ROLES,
    ATTRIBUTE_COEFFS,
    COLUMNS,
    COUNTRY_CODE_MAP,
    DEFAULT_COLUMNS,
    FEET_MAPPING,
    LDC_CACHE_DATA: ldcComputationCache,
    NEGATIVE_STATS,
    PER90_TO_SOURCE,
    PERCENTAGE_TO_SOURCE,
    POSITION_FILTERS,
    SKIPPABLE_STATS,
    STATS_CONFIG,
    ZERO_SKIPPABLE_STATS,
    addAudit,
    addLeagueWithValues,
    applyFilter,
    buildActiveColumns,
    calculateColumnWidth,
    calculatePercentile,
    changePage,
    clearAllDb,
    clearAllState,
    closeFilters,
    collator,
    continueFileProcessing,
    copyToClipboard,
    debounce,
    detectLanguage,
    fileMetaHelper: createFileMetaHelper(),
    filterCheckboxList,
    filterClubHasPossession,
    filterLDCMatchedLeagues,
    filterShowOnlyLDCMatched,
    getBadge,
    getDataBadge,
    getEls,
    getFeetStars,
    getFilteredData,
    getSortedData,
    getStatPercentile,
    getValueRatingBadge,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDragStart,
    handleDrop,
    handleFiles,
    handleHeaderDragEnter,
    handleHeaderDragLeave,
    handleHeaderDragOver,
    handleHeaderDragStart,
    handleHeaderDrop,
    handleResizeStart,
    handleSort,
    handleVirtualScroll,
    ldcStorage,
    mapCountryCode,
    markFiltersDirty,
    markHeadersDirty,
    normalizeDiacritics,
    editOCRResult,
    openDetails: openReactDetails,
    openFilter,
    openPossessionModal,
    processor,
    removeClubPossession,
    removeOCRResult,
    renderBar,
    renderColumnList,
    renderEmptyState,
    renderRatioCell,
    renderTableHeaders: () => {},
    renderTableImmediate: requestTableSync,
    resetAllFilters,
    resetColumnFilter,
    resetColumns,
    runAnalysis: (selectedEngine?: string, selectedPosition?: string) =>
      runImportedAnalysis(selectedEngine, selectedPosition),
    saveLDCSettings,
    scheduleTableRender: requestTableSync,
    selectPossessionClub,
    setFilterArr,
    setLanguage,
    setupScrollInput,
    showAlertModal,
    showConfirmModal,
    showLanguageChoiceModal,
    showModal,
    sortPositionsIntelligently,
    store,
    tableState,
    toggleAllVisible,
    toggleCol,
    togglePin,
    toggleShowActiveInFilter,
    translateHeaderToInterfaceLang,
    translatePosition,
    translateValue,
    updateFilterCounts,
    updateLDCUI,
    updatePageInfo,
    updateResultsMeta,
    updateUI,
    VIRTUAL_BATCH,
    VIRTUAL_BUFFER,
    VIRTUAL_MIN_ROWS,
    VIRTUAL_ROW_HEIGHT
  });

  registerLegacyActionBridge({
    continueImportFlow: continueImportFlowProcessing,
    runAnalysis: runImportedAnalysis
  });
}

async function initializeRuntimeSideEffects(): Promise<void> {
  await import('@/runtime');
}

async function waitForCompatBinding(bind: () => boolean, maxAttempts = 20): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (bind()) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 25));
  }
}

async function initializeBridge(): Promise<void> {
  registerGlobals();
  bindCompatMirrors();
  registerImportFlowBridge();
  await i18n.init();
  await waitForCompatBinding(bindLegacyUpload);

  if (fileStack) {
    (window as any).renderFileStack = fileStack.render.bind(fileStack);
    (window as any).removeFileFromStack = fileStack.remove.bind(fileStack);
    (window as any).remapFileHeaders = fileStack.remap.bind(fileStack);
    (window as any).renderFileStackModal = () => fileStack.render('file-stack-modal');
  }

  if (uiAdapter) {
    uiAdapter.init({
      bindHeaderListeners: () => {},
      getColumns: () => store.currentColumns,
      getElements: () => {
        const els = getEls();
        return {
          errorLog: els.errorLog,
          fileInput: els.fileInput,
          statusText: els.statusText,
          tableBody: null,
          tableHead: null,
          tableScroller: null
        };
      },
      getState: () => store,
      getVirtualState: () => store.virtualState
    });
  }

  bindFilterClickAway();
  bindPossessionModalListeners();
  bootstrapUI();
  await initializeRuntimeSideEffects();

  try {
    const saved = await loadSettings();
    if (saved && typeof saved === 'object') {
      useSettingsStore.getState().initFromLoaded(saved);
    }
  } catch (error) {
    console.warn('[Settings] Failed to load saved settings', error);
  }

  try {
    const uiState = await loadUIState();
    if (uiState) {
      applyLegacyUIState(uiState);
    }
  } catch (error) {
    console.warn('[State] Failed to hydrate UI state', error);
  }

  try {
    await loadLDCSettings();
  } catch (error) {
    console.warn('[LDC] Failed to load LDC settings', error);
  }

  (window as any).persistUIState = () => {
    try {
      const columnWidths: Record<string, number> = {};
      COLUMNS.forEach((column: any) => {
        if (column.savedWidth) {
          columnWidths[column.id] = column.savedWidth;
        }
      });

      saveUIState(
        {
          activeFilters: store.activeFilters,
          columnOrder: COLUMNS.map((column: any) => column.id),
          columnWidths,
          currentSort: store.currentSort,
          hiddenColumns: store.hiddenColumns,
          pinnedColumns: store.pinnedColumns,
          positionFilterMode: store.positionFilterMode,
          rememberLanguageChoice:
            document.querySelector<HTMLInputElement>('#setting-remember-language-choice')
              ?.checked || false,
          roleFiltersEnabled: store.roleFiltersEnabled,
          rowsPerPage: store.rowsPerPage
        },
        (window as any).APP_SETTINGS,
        processor
      );
    } catch (error) {
      console.warn('[State] Legacy persist failed', error);
    }
  };

  (window as any).hydrateUIState = () => {
    try {
      const state = loadUIStateSync();
      if (!state) {
        return;
      }
      applyLegacyUIState(state);
    } catch (error) {
      console.warn('[State] Legacy hydrate failed', error);
    }
  };
}

export function initializeLegacyRuntimeBridge(): Promise<void> {
  if (!runtimeBridgePromise) {
    runtimeBridgePromise = initializeBridge();
  }

  return runtimeBridgePromise;
}
