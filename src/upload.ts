/**
 * ARCHITECTURE NOTE: Upload "Split Brain"
 *
 * This file handles UI events (Drag & Drop) but still delegates file processing
 * through the compatibility bridge exposed as `window.handleFiles`.
 *
 * Relationship between `processor` and `parserBridge`:
 * - `processor`: The legacy-compatible global `DataProcessor` singleton handling
 *   parsing, merging, and analysis side effects.
 * - `parserBridge`: The modern worker-based parsing infrastructure (in `src/workerBridge`).
 *
 * CURRENT FLOW:
 * UI Event -> `handleFiles` (global) -> `processor.parseHTML` -> `parserBridge.parseHtml` (Worker)
 */

// Define global interface extensions
declare global {
  interface Window {
    handleFiles?: (files: File[] | FileList) => Promise<void> | void;
    retryFailedFiles?: () => Promise<void> | void;
  }
}

const dragCounter = { value: 0 };
const legacyUploadBinding = { bound: false };

/**
 * Handles drag enter event
 * Highlights the drop area when files are dragged over
 */
function handleDragEnter(e: DragEvent): void {
  preventDefaults(e);
  const hasFiles = e.dataTransfer?.types?.includes('Files');
  if (!hasFiles) return;

  const dropArea = document.querySelector('#drop-area');

  dragCounter.value += 1;
  if (dropArea && (e.target === dropArea || dropArea.contains(e.target as Node))) {
    dropArea.classList.add('dragover');
  }
}

/**
 * Handles drag leave event
 * Removes highlight when leaving the drop area
 */
function handleDragLeave(e: DragEvent): void {
  preventDefaults(e);
  const dropArea = document.querySelector('#drop-area');
  dragCounter.value -= 1;

  // Only remove class if we've left the dropzone completely
  if (dragCounter.value === 0 && dropArea) {
    dropArea.classList.remove('dragover');
  }
}

/**
 * Handles drag over event
 * Necessary to allow dropping
 */
function handleDragOver(e: DragEvent): void {
  preventDefaults(e);
  const hasFiles = e.dataTransfer?.types?.includes('Files');
  if (!hasFiles) return;

  const dropArea = document.querySelector('#drop-area');

  if (dropArea && (e.target === dropArea || dropArea.contains(e.target as Node))) {
    dropArea.classList.add('dragover');

    e.dataTransfer.dropEffect = 'copy'; // Explicitly show copy cursor
  }
}

/**
 * Handles file drop event
 * Passes files to the legacy global handler
 */
function handleDrop(e: DragEvent): void {
  preventDefaults(e);
  const dropArea = document.querySelector('#drop-area');
  dragCounter.value = 0;

  if (dropArea) dropArea.classList.remove('dragover');

  if (e.dataTransfer?.files?.length && (window as any).handleFiles) {
    const filesArray = [...e.dataTransfer.files];
    (window as any).handleFiles(filesArray);
  }
}

/**
 * Handles file input change event (click to upload)
 */
function handleInputChange(e: Event): void {
  const target = e.target as HTMLInputElement;
  const files = target.files;

  if (files && files.length > 0 && (window as any).handleFiles) {
    // Convert FileList to Array to prevent race condition when resetting input
    const filesArray = [...files];
    (window as any).handleFiles(filesArray);
  }

  // Reset input so same files can be selected again if needed
  if (target) {
    target.value = '';
  }
}

/**
 * Prevents default browser behavior and stop propagation
 */
function preventDefaults(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
}

export function bindLegacyUpload(): boolean {
  if (legacyUploadBinding.bound) {
    return true;
  }

  const dropArea = document.querySelector('#drop-area');
  const fileInput = document.querySelector('#files-input');

  if (!dropArea || !fileInput) {
    return false;
  }

  const events = ['dragenter', 'dragover', 'dragleave', 'drop'];
  events.forEach((eventName) => {
    document.addEventListener(eventName, preventDefaults, false);
  });

  document.addEventListener('dragenter', handleDragEnter, false);
  document.addEventListener('dragleave', handleDragLeave, false);
  document.addEventListener('dragover', handleDragOver, false);
  document.addEventListener('drop', handleDrop, false);
  dropArea.addEventListener('drop', handleDrop, false);
  (fileInput as HTMLInputElement).multiple = true;
  fileInput.addEventListener('change', handleInputChange, false);

  const retryBtn = document.querySelector('#retry-files-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      if ((window as any).retryFailedFiles) {
        (window as any).retryFailedFiles();
      }
    });
  }

  legacyUploadBinding.bound = true;
  return true;
}
