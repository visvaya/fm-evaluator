// Phase 5F: Possession Modal + OCR UI – migrated from main.js
import { hasActivePlayerRows, hasAnalyzedPlayerRows } from '@/lib/playerRowsRuntime';

import { rerunCurrentAnalysis } from '../lib/legacyActionBridge';
import { getProcessor } from '../lib/processorBridge';
import { persistUIState as bridgePersistUIState } from '../lib/uiBridge';
import {
  currentSelectionStep,
  loadOCRAreas,
  ocrAreas,
  ocrSettings,
  pendingFiles,
  resetOCRAreas,
  setCurrentSelectionStep,
  setOcrAreas,
  setPendingFiles
} from '../ocr/ocrSettings';
import { useSettingsStore } from '../store/useSettingsStore';

import {
  getCurrentSelectedClub,
  removeClubPossession,
  renderPossessionClubList,
  saveCurrentClubPossession,
  selectPossessionClub,
  setCurrentSelectedClub
} from './possessionClubList';
import {
  cancelCropArea,
  confirmCropArea,
  destroyCropper,
  setupAreaSelectionWithCropper
} from './possessionCropper';
import { editOCRResult, refreshOCRResultsDisplay, removeOCRResult } from './possessionOCRDisplay';
import { processOCRFiles } from './possessionOCRPipeline';
import { setupScrollInputPercent } from './scrollInputHelper';

// --- module-level state ---
let initialPossessionSnapshot: null | string = null;

// ---- helpers ----

export function bindPossessionModalListeners(): void {
  const proc = getProcessor();

  document
    .querySelector('#possession-club-search')
    ?.addEventListener('input', (e) =>
      renderPossessionClubList((e.target as HTMLInputElement).value)
    );
  document
    .querySelector('#save-club-possession')
    ?.addEventListener('click', saveCurrentClubPossession);
  const possValueInput = document.querySelector('#possession-club-value');
  if (possValueInput) {
    possValueInput.addEventListener('keypress', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Enter') saveCurrentClubPossession();
    });
    possValueInput.addEventListener('blur', saveCurrentClubPossession);
  }

  document.querySelector('#clear-club-selection')?.addEventListener('click', () => {
    setCurrentSelectedClub(null);
    document.querySelector('#possession-club-input-wrapper')?.classList.add('hidden');
    renderPossessionClubList(
      document.querySelector<HTMLInputElement>('#possession-club-search')?.value ?? ''
    );
  });

  document.querySelector('#reset-club-selection-value')?.addEventListener('click', () => {
    const proc = getProcessor();
    proc.teamPossessionMap.delete(proc.normalizeClubName(getCurrentSelectedClub()));
    const vi = document.querySelector<HTMLInputElement>('#possession-club-value');
    if (vi) vi.value = '';
    renderPossessionClubList(
      document.querySelector<HTMLInputElement>('#possession-club-search')?.value ?? ''
    );
  });

  const globalDefaultInput = document.querySelector<HTMLInputElement>('#possession-default-value');
  if (globalDefaultInput) {
    globalDefaultInput.value = String(useSettingsStore.getState().settings.defaultPossession || 50);
    globalDefaultInput.addEventListener('change', (e) => {
      let val = parseInt((e.target as HTMLInputElement).value, 10);
      if (isNaN(val)) val = 50;
      val = Math.max(0, Math.min(100, val));
      useSettingsStore.getState().applySettings({ defaultPossession: val });
      globalDefaultInput.value = String(val);
    });
  }

  document
    .querySelector('#confirm-crop-btn')
    ?.addEventListener('click', () => confirmCropArea(processOCRFiles));
  document.querySelector('#cancel-crop-btn')?.addEventListener('click', cancelCropArea);

  document.querySelector('#change-ocr-areas')?.addEventListener('click', () => {
    setCurrentSelectionStep(0);
    setOcrAreas({ league: null, table: null });
    const fi = document.querySelector<HTMLInputElement>('#possession-ocr-file');
    if (fi) fi.value = '';
    const errorEl = document.querySelector('#possession-modal-error');
    if (errorEl) {
      errorEl.textContent = 'Wgraj ponownie zrzut ekranu, aby zmienić obszary.';
      errorEl.className = 'text-[10px] text-blue-600 font-mono min-h-[14px]';
    }
  });

  const changeOCRAreasBtn = document.querySelector('#change-ocr-areas');
  document.querySelector('#reset-ocr-areas')?.addEventListener('click', () => {
    resetOCRAreas();
    changeOCRAreasBtn?.classList.add('hidden');
    const fi = document.querySelector<HTMLInputElement>('#possession-ocr-file');
    if (fi) fi.value = '';
    document.querySelector('#cropModal')?.classList.add('hidden');
    try {
      destroyCropper();
    } catch {
      /* ignore */
    }
    const errorEl = document.querySelector('#possession-modal-error');
    if (errorEl) {
      errorEl.textContent =
        'Obszary OCR zostały zresetowane. Wgraj zrzut ekranu, aby ponownie je skonfigurować.';
      errorEl.className = 'text-[10px] text-green-600 font-mono min-h-[14px]';
    }
  });

  const ocrFileInput = document.querySelector('#possession-ocr-file');
  if (ocrFileInput) {
    ocrFileInput.addEventListener('change', async (e) => {
      const files = [...((e.target as HTMLInputElement).files || [])];
      if (files.length === 0) return;
      loadOCRAreas();
      const hasAreas =
        ocrAreas.league && ocrAreas.table && ocrAreas.league.width > 0 && ocrAreas.table.width > 0;
      if (hasAreas) {
        processOCRFiles(files);
      } else {
        document.querySelector('#ocr-content')?.classList.remove('hidden');
        setPendingFiles(files);
        try {
          setCurrentSelectionStep(0);
          setOcrAreas({ league: null, table: null });
          await setupAreaSelectionWithCropper(files[0]);
        } catch (error: any) {
          const errorEl = document.querySelector('#possession-modal-error');
          if (errorEl) {
            errorEl.textContent = `Błąd wczytywania obrazu: ${error.message}`;
            errorEl.className = 'text-[10px] text-red-600 font-mono min-h-[14px]';
          }
        }
      }
    });
  }

  document.querySelector('#possession-apply-ocr')?.addEventListener('click', () => {
    const textEl = document.querySelector<HTMLTextAreaElement>('#possession-ocr-text');
    if (!textEl?.value.trim() || !proc) return;
    proc.updatePossessionMapFromText(textEl.value);
    renderPossessionClubList('');
    textEl.value = '';
    document.querySelector('#ocr-content')?.classList.add('hidden');
    const errorEl = document.querySelector('#possession-modal-error');
    if (errorEl) {
      errorEl.textContent = 'Dane zaktualizowane (kliknij "Zapisz" aby zapisać).';
      errorEl.className = 'text-[10px] text-green-600 font-mono min-h-[14px]';
      setTimeout(() => {
        errorEl.textContent = '';
      }, 3000);
    }
  });

  const showOCRSettingsBtn = document.querySelector('#show-ocr-settings');
  const ocrSettingsPanel = document.querySelector('#ocr-settings-panel');
  showOCRSettingsBtn?.addEventListener('click', () => {
    ocrSettingsPanel?.classList.remove('hidden');
    showOCRSettingsBtn.classList.add('hidden');
    const q = document.querySelector<HTMLInputElement>('#ocr-quality-setting');
    const c = document.querySelector<HTMLInputElement>('#ocr-confidence-threshold');
    const p = document.querySelector<HTMLInputElement>('#ocr-psm-mode');
    const cc = document.querySelector<HTMLInputElement>('#ocr-concurrency-limit');
    if (q) q.value = ocrSettings.quality;
    if (c) c.value = String(ocrSettings.confidenceThreshold);
    if (p) p.value = ocrSettings.psmMode;
    if (cc) cc.value = String(ocrSettings.concurrencyLimit);
  });
  document.querySelector('#toggle-ocr-settings')?.addEventListener('click', () => {
    ocrSettingsPanel?.classList.add('hidden');
    showOCRSettingsBtn?.classList.remove('hidden');
  });

  if (document.querySelector('#ocr-settings-content')) {
    document.querySelector('#ocr-quality-setting')?.addEventListener('change', (e) => {
      ocrSettings.quality = (e.target as HTMLSelectElement).value as any;
      ocrSettings.save();
    });
    document.querySelector('#ocr-confidence-threshold')?.addEventListener('change', (e) => {
      ocrSettings.confidenceThreshold = parseInt((e.target as HTMLInputElement).value, 10);
      ocrSettings.save();
    });
    document.querySelector('#ocr-psm-mode')?.addEventListener('change', (e) => {
      ocrSettings.psmMode = (e.target as HTMLSelectElement).value;
      ocrSettings.save();
    });
    document.querySelector('#ocr-concurrency-limit')?.addEventListener('change', (e) => {
      ocrSettings.concurrencyLimit = parseInt((e.target as HTMLInputElement).value, 10);
      ocrSettings.save();
    });
  }

  document.querySelector('#possession-reset')?.addEventListener('click', () => {
    if (!proc) return;
    if (confirm('Usunąć WSZYSTKIE przypisania klubowe?')) {
      proc.resetTeamPossession();
      renderPossessionClubList('');
      setCurrentSelectedClub(null);
      document.querySelector('#possession-club-input-wrapper')?.classList.add('hidden');
    }
  });

  document.querySelector('#possession-close')?.addEventListener('click', () => {
    if (hasUnsavedPossessionChanges()) {
      if (!confirm('Masz niezapisane zmiany. Czy na pewno chcesz je porzucić?')) return;
      if (proc && initialPossessionSnapshot) {
        const initial = JSON.parse(initialPossessionSnapshot);
        proc.teamPossessionMap.clear();
        Object.entries(initial.map).forEach(([key, val]) => proc.teamPossessionMap.set(key, val));
        useSettingsStore.getState().applySettings({ defaultPossession: initial.defaultPossession });
        const di = document.querySelector<HTMLInputElement>('#possession-default-value');
        if (di) di.value = String(initial.defaultPossession);
      }
    }
    document.querySelector('#possession-modal')?.classList.add('hidden');
  });

  document.querySelector('#possession-save')?.addEventListener('click', () => {
    persistUIState();
    initialPossessionSnapshot = getPossessionSnapshot();
    document.querySelector('#possession-modal')?.classList.add('hidden');
    if (hasAnalyzedPlayerRows()) {
      rerunCurrentAnalysis();
    }
  });

  document.querySelector('#possession-close-x')?.addEventListener('click', () => {
    document.querySelector('#possession-modal')?.classList.add('hidden');
  });

  document.querySelector('#possession-btn')?.addEventListener('click', () => {
    if (!hasActivePlayerRows()) {
      const err = document.querySelector('#possession-modal-error');
      if (err) err.textContent = 'Najpierw wgraj dane zawodników, aby wybrać klub.';
    }
    openPossessionModal();
  });

  const possessionModal = document.querySelector('#possession-modal');
  possessionModal?.addEventListener('click', (e) => {
    if (e.target === possessionModal) possessionModal.classList.add('hidden');
  });
}

export function openPossessionModal(): void {
  const modal = document.querySelector('#possession-modal');
  if (!modal) return;

  initialPossessionSnapshot = getPossessionSnapshot();
  const hasAreas = loadOCRAreas();
  const changeBtn = document.querySelector('#change-ocr-areas');
  if (changeBtn) {
    changeBtn.classList.toggle('hidden', !(hasAreas && ocrAreas.league && ocrAreas.table));
  }

  const possSearchEl = document.querySelector<HTMLInputElement>('#possession-club-search');
  if (possSearchEl) possSearchEl.value = '';
  const errEl = document.querySelector('#possession-modal-error');
  if (errEl) errEl.textContent = '';
  document.querySelector('#possession-club-input-wrapper')?.classList.add('hidden');
  document.querySelector('#ocr-content')?.classList.add('hidden');
  document.querySelector('#club-config-content')?.classList.add('hidden');
  document.querySelector('#ocr-area-selection')?.classList.add('hidden');
  document.querySelector('#cropModal')?.classList.add('hidden');

  try {
    if ((window as any).ocrCropper) {
      (window as any).ocrCropper.destroy();
      (window as any).ocrCropper = null;
    }
    destroyCropper();
  } catch {
    /* ignore */
  }

  const ocrFileInput = document.querySelector<HTMLInputElement>('#possession-ocr-file');
  if (ocrFileInput) ocrFileInput.value = '';
  const ocrTextEl = document.querySelector<HTMLTextAreaElement>('#possession-ocr-text');
  if (ocrTextEl) ocrTextEl.value = '';
  document.querySelector('#ocr-progress-container')?.classList.add('hidden');
  document.querySelector('#ocr-preview-container')?.classList.add('hidden');

  setupScrollInputPercent('possession-club-value', 1, 50);
  setupScrollInputPercent('possession-default-value', 1, 50);
  renderPossessionClubList('');
  modal.classList.remove('hidden');
}

// ---- Possession snapshot ----

// ---- Possession modal ----

function getPossessionSnapshot(): string {
  const proc = getProcessor();
  const mapObj: Record<string, number> = {};
  if (proc)
    proc.teamPossessionMap.forEach((val: number, key: string) => {
      mapObj[key] = val;
    });
  return JSON.stringify({
    defaultPossession: useSettingsStore.getState().settings.defaultPossession || 50,
    map: mapObj
  });
}

// ---- Scroll input helper ----

// ---- Club selection + save ----

function hasUnsavedPossessionChanges(): boolean {
  if (!initialPossessionSnapshot) return false;
  return getPossessionSnapshot() !== initialPossessionSnapshot;
}

// ---- Event listeners binding ----

function persistUIState(): void {
  bridgePersistUIState();
}
