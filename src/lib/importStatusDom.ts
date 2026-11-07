export type ImportStatusKind = 'error' | 'idle' | 'info' | 'processing' | 'success';

export interface ImportStatusState {
  canRetry: boolean;
  details: string[];
  kind: ImportStatusKind;
  message: string;
}

export const DEFAULT_IMPORT_STATUS: ImportStatusState = {
  canRetry: false,
  details: [],
  kind: 'idle',
  message: ''
};

export function syncImportStatusDom(status: ImportStatusState): void {
  if (typeof document === 'undefined') {
    return;
  }

  const statusRoot = document.querySelector<HTMLElement>('#upload-status-text');
  const statusContent = statusRoot?.querySelector<HTMLElement>('.upload-status-content');
  const errorRoot = document.querySelector<HTMLElement>('#error-log');
  const errorContent = errorRoot?.querySelector<HTMLElement>('.error-log-content');
  const retryRoot = document.querySelector<HTMLElement>('#retry-error-container');
  const loadingOverlay = document.querySelector<HTMLElement>('#loading-overlay');

  if (
    statusRoot?.dataset.reactManaged === 'true' ||
    errorRoot?.dataset.reactManaged === 'true' ||
    retryRoot?.dataset.reactManaged === 'true'
  ) {
    return;
  }

  if (loadingOverlay) {
    loadingOverlay.style.display = status.kind === 'processing' ? 'flex' : 'none';
  }

  if (statusRoot && statusContent) {
    if (status.kind === 'idle' || !status.message) {
      statusRoot.classList.add('hidden');
      statusContent.textContent = '';
    } else {
      statusRoot.classList.remove('hidden');
      statusRoot.dataset.statusKind = status.kind;
      statusContent.textContent = status.message;
    }
  }

  if (errorRoot && errorContent) {
    if (status.kind === 'error' && status.details.length > 0) {
      errorRoot.classList.remove('hidden');
      errorContent.textContent = status.details.join('\n');
    } else {
      errorRoot.classList.add('hidden');
      errorContent.textContent = '';
    }
  }

  if (retryRoot) {
    retryRoot.classList.toggle('hidden', !status.canRetry);
  }
}
