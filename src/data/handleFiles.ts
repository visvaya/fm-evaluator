// Phase 5E: handleFiles + file management migrated from app/main.js
import { getEls } from '../config/columns';
import { continueImportFlowProcessing, rerunCurrentAnalysis } from '../lib/legacyActionBridge';
import { store } from '../store/tableStore';
import { useTableStore } from '../store/useTableStore';
import { fileStackTypeLabels, renderFileStackCards } from '../ui/fileStackCards';
import { getFilteredData } from '../ui/filterData';
import { reorderFileStackItems } from '../ui/fileStackState';
import {
  getExistingFileStackNames,
  getFileStackItems,
  hasFileStackItems,
  shouldAppendToFileStack
} from '../ui/fileStackRuntime';
import { attachFileStackDragDrop, renderActiveFileStackState } from '../ui/fileStackUi';
import { changePage, runAnalysis, scheduleTableRender } from '../ui/tableOrchestrator';
import { t, getCurrentLanguage } from '../lib/i18nBridge';
import { persistUIState } from '../lib/uiBridge';
import {
  applyPostImportLanguageDecision,
  continueImportAfterParsing,
  getDominantDetectedLanguage,
  prepareImportedFiles,
  recordImportedFilesMetadata,
  processImportedFilesBatch,
  resolvePostImportLanguageDecision
} from './importRuntime';

import { processor } from './dataProcessor';

// Lazy DOM accessor – calls getEls() on each property access to handle DOM not ready at module load
const els = new Proxy({} as any, { get: (_: any, p: string) => (getEls() as any)[p] });

function setLanguage(lang: string) {
  return (window as any).setLanguage?.(lang);
}
function showLanguageChoiceModal(detected: string, current: string) {
  return (window as any).showLanguageChoiceModal?.(detected, current);
}
function addAudit(event: string, data?: Record<string, unknown>, level?: string): void {
  (window as any).addAudit?.(event, data, level);
}

let failedFiles: File[] = [];

function retryFailedFiles() {
  if (!failedFiles || failedFiles.length === 0) return;
  handleFiles(createFailedFilesTransfer(failedFiles).files, true);
}

function createFailedFilesTransfer(files: File[]): DataTransfer {
  const dataTransfer = new DataTransfer();
  files.forEach((file) => {
    dataTransfer.items.add(file);
  });
  return dataTransfer;
}

function wireRetryButton(onRetry: () => void): void {
  const retryContainer = document.querySelector('#retry-error-container');
  const retryBtn = document.querySelector('#retry-files-btn');
  if (!retryContainer || !retryBtn || !retryBtn.parentNode) {
    return;
  }

  retryContainer.classList.remove('hidden');
  const newRetryBtn = retryBtn.cloneNode(true);
  retryBtn.parentNode.replaceChild(newRetryBtn, retryBtn);
  newRetryBtn.addEventListener('click', onRetry);
}

export async function handleFiles(files: any, force = false) {
  if (!files || files.length === 0) return;
  addAudit('files_processing_started', { count: files.length }, 'info');

  const loadingOverlay = document.querySelector('#loading-overlay');
  let processedCount = 0;
  const errors = [];
  failedFiles = []; // Reset at start to capture duplicates

  const updateUIState = (type, visible, message = '', _extraClasses = []) => {
    if (!visible) {
      if (type === 'error') {
        return;
      }

      useTableStore.getState().clearImportStatus();
      return;
    }

    if (type === 'error') {
      useTableStore.getState().setImportStatus({
        canRetry: failedFiles.length > 0,
        details: message ? message.split('<br>') : [],
        kind: 'error',
        message: 'Import completed with errors.'
      });
      return;
    }

    useTableStore.getState().setImportStatus({
      canRetry: false,
      details: [],
      kind: message.toLowerCase().includes('przetwarz') ? 'processing' : 'info',
      message
    });
  };

  try {
    // Check for duplicate files (name + content hash when available)
    const existingFileNames = getExistingFileStackNames(processor);
    const metaHelper = (window as any).fileMetaHelper || null;
    const preflight = await prepareImportedFiles({
      files,
      force,
      isKnownDuplicateHash: metaHelper ? (file) => metaHelper.isDuplicate(file) : undefined,
      isKnownDuplicateName: (file) => existingFileNames.has(file.name),
      onDuplicateHashCheckFailed: (file, error) => {
        console.warn('[FileMeta] Duplicate check failed', error);
        addAudit('file_duplicate_check_failed', { error: String(error), name: file.name }, 'warn');
      },
      onFileRejected: (file, reason) => {
        const duplicateMessages = {
          'duplicate-hash': `Plik "${file.name}" (hash) został już wczytany. Pominięto duplikat.`,
          'duplicate-name': `Plik "${file.name}" został już wczytany. Pominięto duplikat.`
        } as const;
        const duplicateAuditEvents = {
          'duplicate-hash': 'file_duplicate_hash',
          'duplicate-name': 'file_duplicate_name'
        } as const;

        updateUIState('error', true, duplicateMessages[reason]);
        addAudit(duplicateAuditEvents[reason], { name: file.name }, 'warn');
      }
    });
    const newFiles = preflight.newFiles;
    failedFiles.push(...preflight.failedFiles);

    if (newFiles.length === 0) {
      // Keep the error status set by duplicate detection – only show info if no errors
      if (failedFiles.length === 0) {
        updateUIState('status', true, 'Wszystkie pliki zostały już wczytane.');
      }

      // Show retry button if we have failed files (e.g. duplicates)
      if (failedFiles.length > 0) {
        wireRetryButton(retryFailedFiles);
      }
      return;
    }

    // Record metadata (content hash) for dedup
    if (metaHelper) {
      await recordImportedFilesMetadata({
        files: newFiles,
        onRecordError: (_file, error) => {
          console.warn('[FileMeta] Failed to record file', error);
        },
        recordFile: (file) => metaHelper.recordFile(file)
      });
    }

    const plural =
      newFiles.length === 1 ? '' : (getCurrentLanguage() || 'en') === 'pl' ? 'ów' : 's';
    updateUIState('status', true, t('processing_files', 'ui', { count: newFiles.length, plural }));
    updateUIState('error', false);
    const retryContainer = document.querySelector('#retry-error-container');
    if (retryContainer) retryContainer.classList.add('hidden');
    if (loadingOverlay) (loadingOverlay as HTMLElement).style.display = 'flex';

    // Helper function to update status with progress
    const updateStatus = (message, currentFile = null, totalFiles = null) => {
      let statusMsg = message;
      if (currentFile !== null && totalFiles !== null && totalFiles > 1) {
        statusMsg = `[${currentFile}/${totalFiles}] ${message}`;
      }
      updateUIState('status', true, statusMsg);
    };

    // Store files for potential retry
    // failedFiles = []; // Initialized at start
    const batchResult = await processImportedFilesBatch({
      files: newFiles,
      onParseError: (file, error) => {
        console.error('[handleFiles] Error processing file:', file.name, error);
        addAudit('file_parse_error', { error: String(error), name: file.name }, 'error');
      },
      onReadError: (file) => {
        console.error(`[handleFiles] FileReader error for ${file.name}`);
        addAudit('file_read_error', { name: file.name }, 'error');
      },
      onStatus: updateStatus,
      parseHTML: processor.parseHTML.bind(processor),
      shouldAppendAtIndex: (index) => shouldAppendToFileStack(processor, index)
    });
    processedCount = batchResult.processedCount;
    errors.push(...batchResult.errors);
    failedFiles.push(...batchResult.failedFiles);

    // If user cancelled processing (Cancel All), stop here and keep status visible
    if (batchResult.cancelled) {
      updateStatus('Anulowano przetwarzanie pozostałych plików');
      return;
    }

    // Display errors if any occurred
    if (errors.length > 0) {
      updateUIState('status', true, 'Wystąpiły błędy podczas wczytywania plików.');
      updateUIState('error', true, errors.join('<br>'));

      // Show retry button if there are failed files
      if (failedFiles.length > 0) {
        wireRetryButton(() => {
          handleFiles(createFailedFilesTransfer(failedFiles).files);
        });
      }

      // Continue only if at least one file succeeded
      if (failedFiles.length === newFiles.length) {
        return;
      }
    }

    // Check if file languages differ from interface language
    const detectedFileLang = getDominantDetectedLanguage(processor);
    if (detectedFileLang) {
      const languageDecision = resolvePostImportLanguageDecision({
        currentLanguage: getCurrentLanguage(),
        detectedLanguage: detectedFileLang,
        localStorageLike: localStorage,
        sessionStorageLike: sessionStorage
      });
      const handled = await applyPostImportLanguageDecision(languageDecision, {
        continueImport: () =>
          continueImportAfterParsing({ onContinue: continueImportFlowProcessing, processor }),
        setLanguage,
        showChoiceModal: showLanguageChoiceModal
      });
      if (handled) return;
    }

    // Continue with normal processing
    await continueImportAfterParsing({
      onContinue: continueImportFlowProcessing,
      processor
    });
  } catch (error) {
    console.error('[handleFiles] Unexpected error:', error);
    addAudit('files_unexpected_error', { error: String(error) }, 'error');
    updateUIState(
      'error',
      true,
      `Błąd: ${error.message || 'Nieoczekiwany błąd podczas przetwarzania plików'}`
    );
  } finally {
    // Always hide loading overlay, even if there was an error
    if (loadingOverlay) (loadingOverlay as HTMLElement).style.display = 'none';
    addAudit(
      'files_processing_finished',
      { errors: errors.length, processed: processedCount },
      errors.length > 0 ? 'warn' : 'info'
    );
  }
}

// Handle single type prompt buttons
const btnProcessNow = document.querySelector('#btn-process-now');
const singleTypePrompt = document.querySelector('#single-type-prompt');

if (btnProcessNow) {
  btnProcessNow.addEventListener('click', () => {
    // Get selected merge mode
    const mergeModeRadio = document.querySelector('input[name="merge-mode"]:checked');
    const mergeMode = mergeModeRadio
      ? (mergeModeRadio as HTMLInputElement).value === 'true'
      : false;
    useTableStore.getState().setMergeMode(mergeMode ? 'merge' : 'replace');

    continueImportFlowProcessing();
    if (singleTypePrompt) {
      singleTypePrompt.classList.add('hidden');
    }
    els.step1?.classList.add('hidden');
    els.step2?.classList.remove('hidden');
  });
}

(window as any).commitConfig = function () {
  const cEngine = (document.querySelector('#central-engine-select') as HTMLSelectElement)?.value;
  const cPos = (document.querySelector('#central-position-select') as HTMLSelectElement)?.value;
  if (!cPos) return;

  const engineSelect = document.querySelector('#engine-select') as HTMLSelectElement;
  const posSelect = document.querySelector('#position-select') as HTMLSelectElement;

  if (engineSelect) engineSelect.value = cEngine;
  if (posSelect) posSelect.value = cPos;

  rerunCurrentAnalysis(cEngine, cPos);

  els.centralZone?.classList.add('opacity-0', 'pointer-events-none');
  setTimeout(() => {
    els.centralZone?.classList.add('hidden');
    els.headerControls?.classList.remove('hidden');
    // Always show header upload controls to allow adding more files
    const headerUploadControls = document.querySelector('#header-upload-controls');
    if (headerUploadControls) {
      headerUploadControls.classList.remove('hidden');
    }
  }, 500);
};

// Handle additional files upload after analysis started
// File Management Modal handlers
const manageFilesBtn = document.querySelector('#manage-files-btn');
const fileManagementModal = document.querySelector('#file-management-modal');
const closeFileManagementModal = document.querySelector('#close-file-management-modal');
const filesInputModal = document.querySelector('#files-input-modal');
const dropAreaModal = document.querySelector('#drop-area-modal');

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

if (manageFilesBtn) {
  manageFilesBtn.addEventListener('click', () => {
    if (fileManagementModal) {
      fileManagementModal.classList.remove('hidden');
      // Render file stack in modal
      renderFileStackModal();
    }
  });
}

if (closeFileManagementModal) {
  closeFileManagementModal.addEventListener('click', () => {
    if (fileManagementModal) {
      fileManagementModal.classList.add('hidden');
    }
  });
}

// Setup file input and drag-drop for modal
if (filesInputModal) {
  filesInputModal.addEventListener('change', (e) => {
    handleFiles((e.target as HTMLInputElement).files);
  });
}

if (dropAreaModal) {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    dropAreaModal.addEventListener(eventName, preventDefaults, false);
  });

  let modalDragCounter = 0;

  dropAreaModal.addEventListener('dragenter', (e) => {
    // Only highlight if dragging files from file system (not from page elements)
    const hasFiles = (e as DragEvent).dataTransfer?.types?.includes('Files');
    if (!hasFiles) return;

    modalDragCounter++;
    dropAreaModal.classList.add('dragover');
  });

  dropAreaModal.addEventListener('dragleave', (_event) => {
    modalDragCounter--;
    if (modalDragCounter === 0) {
      dropAreaModal.classList.remove('dragover');
    }
  });

  dropAreaModal.addEventListener('dragover', (e) => {
    // Only highlight if dragging files from file system (not from page elements)
    const hasFiles = (e as DragEvent).dataTransfer?.types?.includes('Files');
    if (!hasFiles) return;

    dropAreaModal.classList.add('dragover');
  });

  dropAreaModal.addEventListener('drop', async (e) => {
    modalDragCounter = 0;
    dropAreaModal.classList.remove('dragover');

    if ((e as DragEvent).dataTransfer.files.length > 0) {
      await handleFiles((e as DragEvent).dataTransfer.files);
      renderFileStackModal();
    }
  });
}

// Also handle files input change in modal
if (filesInputModal) {
  filesInputModal.addEventListener('change', async (e) => {
    await handleFiles((e.target as HTMLInputElement).files);
    renderFileStackModal();
  });
}

export function renderFileStackModal() {
  const fileStackModal = document.querySelector('#file-stack-modal');
  if (!fileStackModal) return;

  if (!hasFileStackItems(processor)) {
    fileStackModal.innerHTML =
      '<p class="text-sm text-gray-500 font-mono">Brak wczytanych plików.</p>';
    const mergeModeSelectionModal = document.querySelector('#merge-mode-selection-modal');
    if (mergeModeSelectionModal) mergeModeSelectionModal.classList.add('hidden');
    return;
  }

  renderActiveFileStackState(
    fileStackModal as HTMLElement,
    renderFileStackCards(getFileStackItems(processor), {
      typeLabels: fileStackTypeLabels.modal
    })
  );

  // Show merge mode selection
  const mergeModeSelectionModal = document.querySelector('#merge-mode-selection-modal');
  if (mergeModeSelectionModal && hasFileStackItems(processor)) {
    mergeModeSelectionModal.classList.remove('hidden');
  }

  // Setup drag and drop
  attachFileStackDragDrop('file-stack-modal', (from, to) => {
    reorderFileStackItems(processor, from, to);
    renderFileStackModal();
    scheduleTableRender();
  });
}

const _mergeStatusText = document.querySelector('#merge-status-text');

document.querySelector('#position-select')?.addEventListener('change', () => runAnalysis());
document.querySelector('#engine-select')?.addEventListener('change', () => runAnalysis());
const rowsPerPageInput = document.querySelector('#rows-per-page');
const handleRowsPerPageChange = (e: any) => {
  let value = Math.max(1, Math.min(1000, Math.floor(+(e.target as HTMLInputElement).value) || 10));
  if (value < 1) value = 1;
  if (value > 1000) value = 1000;
  (e.target as HTMLInputElement).value = value.toString();
  store.rowsPerPage = value;
  store.currentPage = 1;
  persistUIState();
  scheduleTableRender();
};
rowsPerPageInput?.addEventListener('change', handleRowsPerPageChange);
rowsPerPageInput?.addEventListener('blur', handleRowsPerPageChange);
rowsPerPageInput?.addEventListener('keypress', (e: Event) => {
  if ((e as KeyboardEvent).key === 'Enter') {
    (e as KeyboardEvent).preventDefault();
    handleRowsPerPageChange(e);
  }
});
rowsPerPageInput?.addEventListener(
  'wheel',
  (e: Event) => {
    if (document.activeElement !== rowsPerPageInput) return;
    (e as WheelEvent).preventDefault();
    const delta = (e as WheelEvent).deltaY < 0 ? 1 : -1;
    const newValue = Math.max(
      1,
      Math.min(1000, (+(rowsPerPageInput as HTMLInputElement).value || 10) + delta)
    );
    (rowsPerPageInput as HTMLInputElement).value = newValue.toString();
    handleRowsPerPageChange({ target: rowsPerPageInput });
  },
  { passive: false }
);

const pageNumberInput = document.querySelector('#page-number');
const handlePageNumberChange = (e: any) => {
  const filteredLength = getFilteredData().length;
  const max = filteredLength === 0 ? 0 : Math.ceil(filteredLength / store.rowsPerPage);
  if (max === 0) {
    store.currentPage = 0;
    scheduleTableRender();
    return;
  }
  let value = Math.max(1, Math.min(max, Math.floor(+(e.target as HTMLInputElement).value) || 1));
  if (value < 1) value = 1;
  if (value > max) value = max;
  (e.target as HTMLInputElement).value = value.toString();
  store.currentPage = value;
  persistUIState();
  scheduleTableRender();
};
pageNumberInput?.addEventListener('blur', handlePageNumberChange);
pageNumberInput?.addEventListener('keypress', (e: Event) => {
  if ((e as KeyboardEvent).key === 'Enter') {
    (e as KeyboardEvent).preventDefault();
    handlePageNumberChange(e);
  }
});
pageNumberInput?.addEventListener(
  'wheel',
  (e: Event) => {
    if (document.activeElement !== pageNumberInput) return;
    (e as WheelEvent).preventDefault();
    const filteredLength = getFilteredData().length;
    const max = filteredLength === 0 ? 0 : Math.ceil(filteredLength / store.rowsPerPage);
    if (max === 0) return;
    const delta = (e as WheelEvent).deltaY < 0 ? 1 : -1;
    const newValue = Math.max(
      1,
      Math.min(max, (+(pageNumberInput as HTMLInputElement).value || 1) + delta)
    );
    (pageNumberInput as HTMLInputElement).value = newValue.toString();
    handlePageNumberChange({ target: pageNumberInput });
  },
  { passive: false }
);

['first', 'prev', 'next', 'last'].forEach((d) =>
  document.getElementById(`page-${d}`)?.addEventListener('click', () => changePage(d))
);
// Funkcja aktualizująca stan checkboxów normalizacji
