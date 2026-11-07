// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  attachFileStackDragDrop,
  getFileStackContainer,
  getLoadingOverlay,
  reportFileStackCriticalError,
  renderActiveFileStackState,
  renderEmptyFileStackState,
  setLoadingOverlayVisible,
  syncFileStackViews,
  waitForNextPaint
} from './fileStackUi';

const setupFileStackDragAndDropMock = vi.fn();

vi.mock('./dragDrop', () => ({
  setupFileStackDragAndDrop: setupFileStackDragAndDropMock
}));

describe('fileStackUi', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="loading-overlay" style="display: none;"></div>
      <div id="file-stack" class="hidden"></div>
      <div id="merge-mode-selection" class="hidden"></div>
      <div id="upload-mode-description"></div>
      <div id="error-log" class="hidden"><span class="error-log-content"></span></div>
    `;
    window.renderFileStackModal = undefined;
    setupFileStackDragAndDropMock.mockReset();
  });

  it('toggles the shared loading overlay', () => {
    expect(getLoadingOverlay()?.style.display).toBe('none');

    setLoadingOverlayVisible(true);
    expect(getLoadingOverlay()?.style.display).toBe('flex');

    setLoadingOverlayVisible(false);
    expect(getLoadingOverlay()?.style.display).toBe('none');
  });

  it('returns the requested file stack container', () => {
    expect(getFileStackContainer('file-stack')?.id).toBe('file-stack');
  });

  it('reports critical file stack errors into the legacy log area', () => {
    reportFileStackCriticalError('boom');

    expect(document.querySelector('#error-log')?.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('.error-log-content')?.textContent).toBe('Błąd krytyczny: boom');
  });

  it('syncs the main and modal file stack views via callbacks', () => {
    const renderMain = vi.fn();
    const renderModal = vi.fn();

    syncFileStackViews(renderMain, renderModal);

    expect(renderMain).toHaveBeenCalledTimes(1);
    expect(renderModal).toHaveBeenCalledTimes(1);
  });

  it('calls only the main render when no modal callback is provided', () => {
    const renderMain = vi.fn();

    syncFileStackViews(renderMain);

    expect(renderMain).toHaveBeenCalledTimes(1);
  });

  it('renders the empty file stack state', () => {
    const container = getFileStackContainer('file-stack');
    if (!container) {
      throw new Error('Missing file-stack container');
    }
    container.innerHTML = 'stale';

    renderEmptyFileStackState(container);

    expect(container?.innerHTML).toBe('');
    expect(container?.classList.contains('hidden')).toBe(true);
    expect(document.querySelector('#merge-mode-selection')?.classList.contains('hidden')).toBe(
      true
    );
    expect(document.querySelector('#upload-mode-description')?.classList.contains('hidden')).toBe(
      false
    );
  });

  it('renders the active file stack state', () => {
    const container = getFileStackContainer('file-stack');
    if (!container) {
      throw new Error('Missing file-stack container');
    }

    renderActiveFileStackState(container, '<div class="file-card"></div>');

    expect(container?.classList.contains('hidden')).toBe(false);
    expect(container?.querySelectorAll('.file-card')).toHaveLength(1);
    expect(document.querySelector('#merge-mode-selection')?.classList.contains('hidden')).toBe(
      false
    );
    expect(document.querySelector('#upload-mode-description')?.classList.contains('hidden')).toBe(
      true
    );
  });

  it('attaches file stack drag drop lazily', async () => {
    attachFileStackDragDrop('file-stack', vi.fn());

    await vi.waitFor(() => {
      expect(setupFileStackDragAndDropMock).toHaveBeenCalledTimes(1);
    });
  });

  it('waits for a browser paint tick', async () => {
    await expect(waitForNextPaint()).resolves.toBeUndefined();
  });
});
