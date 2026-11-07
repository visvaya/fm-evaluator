export function getLoadingOverlay() {
  return document.querySelector<HTMLElement>('#loading-overlay');
}

export function getFileStackContainer(containerId: string) {
  return document.querySelector<HTMLElement>(`#${containerId}`);
}

export function setLoadingOverlayVisible(visible: boolean) {
  const loadingOverlay = getLoadingOverlay();
  if (!loadingOverlay) return;

  // Legacy file-stack flows still drive a shared DOM overlay directly.
  loadingOverlay.style.display = visible ? 'flex' : 'none';
}

export function reportFileStackCriticalError(message: string) {
  const errorLog = document.querySelector('#error-log');
  if (!errorLog) return;

  const content = errorLog.querySelector('.error-log-content');
  if (content) {
    // Legacy error reporting writes into an existing DOM sink.
    content.textContent = `Błąd krytyczny: ${message}`;
  }
  errorLog.classList.remove('hidden');
}

export function renderEmptyFileStackState(container: HTMLElement) {
  // Rendering this legacy surface still updates an existing DOM container directly.
  container.innerHTML = '';
  container.classList.add('hidden');
  document.querySelector('#merge-mode-selection')?.classList.add('hidden');
  document.querySelector('#upload-mode-description')?.classList.remove('hidden');
}

export function renderActiveFileStackState(container: HTMLElement, content: string) {
  container.classList.remove('hidden');
  document.querySelector('#merge-mode-selection')?.classList.remove('hidden');
  document.querySelector('#upload-mode-description')?.classList.add('hidden');
  // Rendering this legacy surface still updates an existing DOM container directly.
  container.innerHTML = content;
}

export function attachFileStackDragDrop(
  containerId: string,
  onReorder: (fromIndex: number, toIndex: number) => void
) {
  void import('./dragDrop').then((module) => {
    return module.setupFileStackDragAndDrop(containerId, onReorder);
  });
}

export function syncFileStackViews(onRenderMain: () => void, onRenderModal: () => void = () => {}) {
  onRenderMain();
  onRenderModal();
}

export async function waitForNextPaint() {
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}
